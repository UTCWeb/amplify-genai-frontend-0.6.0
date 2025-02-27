// src/hooks/useChatService.js
import {useCallback, useContext, useEffect, useRef} from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {killRequest as killReq, MetaHandler} from '../services/chatService';
import {ChatBody, Conversation, CustomFunction, JsonSchema, Message, newMessage} from "@/types/chat";
import {ColumnsSpec,} from "@/utils/app/csv";
import {Plugin, PluginID} from '@/types/plugin';

import {useSession} from "next-auth/react"
import json5 from "json5";
import {Model, ModelID, Models} from "@/types/model";
import {newStatus} from "@/types/workflow";
import {ReservedTags} from "@/types/tags";
import {deepMerge} from "@/utils/app/state";
import toast from "react-hot-toast";
import {OutOfOrderResults} from "@/utils/app/outOfOrder";
import {conversationWithCompressedMessages, saveConversations} from "@/utils/app/conversation";
import {getHook} from "@/utils/app/chathooks";
import {AttachedDocument} from "@/types/attacheddocument";
import {Prompt} from "@/types/prompt";
import {usePromptFinderService} from "@/hooks/usePromptFinderService";
import {useChatService} from "@/hooks/useChatService";
import { ARTIFACTS_PROMPT, DEFAULT_TEMPERATURE } from "@/utils/app/const";
import { uploadConversation } from "@/services/remoteConversationService";
import { getFocusedMessages } from '@/services/prepareChatService';
import { getSettings } from '@/utils/app/settings';


export type ChatRequest = {
    message: Message;
    endpoint?: string;
    deleteCount?: number;
    plugin?: Plugin | null;
    existingResponse?: any;
    rootPrompt?: string | null;
    documents?: AttachedDocument[] | null;
    uri?: string | null;
    options?: { [key: string]: any };
    assistantId?: string;
    prompt?: Prompt;
    conversationId?: string;
};

export function useSendService() {
    const {
        state: {selectedConversation, conversations, featureFlags, folders, chatEndpoint, statsService},
        handleUpdateConversation,
        postProcessingCallbacks,
        dispatch:homeDispatch,
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = session?.user;

    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const {
        sendChatRequest,
        sendJsonChatRequestWithSchemaLoose,
        sendFunctionChatRequest,
        sendJsonChatRequest,
        sendJsonChatRequestWithSchema,
        sendCSVChatRequest
    } = useChatService();

    const {getPrefix} = usePromptFinderService();

    const calculateTokenCost = (chatModel: Model, datasources: AttachedDocument[]) => {
        let cost = 0;

        datasources.forEach((doc) => {
            if (doc.metadata?.totalTokens) {
                cost += doc.metadata.totalTokens;
            }
        });

        const model = Models[chatModel.id as ModelID];
        if (!model) {
            return {
                prompts: -1,
                inputTokens: cost,
                inputCost: -1,
                outputCost: -1,
                totalCost: -1
            };
        }

        const contextWindow = model.actualTokenLimit;
        // calculate cost / context window rounded up
        const prompts = Math.ceil(cost / contextWindow);

        console.log("Prompts", prompts, "Cost", cost, "Context Window", contextWindow);

        const outputCost = prompts * model.outputCost;
        const inputCost = (cost / 1000) * model.inputCost;

        console.log("Input Cost", inputCost, "Output Cost", outputCost);

        return {
            prompts: prompts,
            inputCost: inputCost.toFixed(2),
            inputTokens: cost,
            outputCost: outputCost.toFixed(2),
            totalCost: (inputCost + outputCost).toFixed(2)
        };
    }

    const handleSend = useCallback(
        async (request:ChatRequest, shouldAbort:()=>boolean) => {
            return new Promise(async (resolve, reject) => {
                if (selectedConversation) { 

                    let {
                        message,
                        deleteCount,
                        plugin,
                        existingResponse,
                        rootPrompt,
                        documents,
                        uri,
                        options,
                        conversationId
                    } = request;


                    const {content, label} = getPrefix(selectedConversation, message);
                    if (content) {
                        message.content = content + " " + message.content;
                        message.label = label;
                    }

                    if (!featureFlags.ragEnabled) {
                        options = {...(options || {}), skipRag: true};
                    }

                    if (selectedConversation
                        && selectedConversation?.model
                        && !options?.ragOnly) {

                        const {prompts, inputCost, inputTokens, outputCost, totalCost} =
                            calculateTokenCost(selectedConversation.model, documents || []);

                        if (totalCost === -1 && inputTokens > 4000) {
                            const go = confirm(`This request will require ${inputTokens} input tokens at an unknown cost.`);
                            if (!go) {
                                return;
                            }
                        }
                        if (+totalCost > 0.5) {
                            const go = confirm(`This request will cost an estimated $${totalCost} (the actual cost may be more) and require ${prompts} prompt(s).`);
                            if (!go) {
                                return;
                            }
                        }
                    }

                    let updatedConversation: Conversation;
                    if (deleteCount) {
                        const updatedMessages = [... selectedConversation.messages];
                        for (let i = 0; i < deleteCount; i++) {
                            updatedMessages.pop();
                        }
                        updatedConversation = {
                            ...selectedConversation,
                            messages: [...updatedMessages, message],
                        };
                    } else {
                        updatedConversation = {
                            ...selectedConversation,
                            messages: [... selectedConversation.messages, message],
                        };
                    }
                    console.log("updated: ", updatedConversation.messages);
                    homeDispatch({
                        field: 'selectedConversation',
                        value: updatedConversation,
                    });

                    homeDispatch({field: 'loading', value: true});
                    homeDispatch({field: 'messageIsStreaming', value: true});

                    const settings = getSettings(featureFlags);
                    // if both artifact and smart messages is off then it returnes with the messages right away 
                    const prepareMessages = await getFocusedMessages(chatEndpoint || '', updatedConversation, statsService, featureFlags, homeDispatch, settings.featureOptions);

                    const chatBody: ChatBody = {
                        model: updatedConversation.model, 
                        messages: prepareMessages, //updatedConversation.messages,
                        prompt: rootPrompt || updatedConversation.prompt || "",
                        temperature: updatedConversation.temperature || DEFAULT_TEMPERATURE,
                        maxTokens: updatedConversation.maxTokens || 1000,
                        conversationId
                    };

                    if (featureFlags.artifacts && settings.featureOptions.includeArtifacts) {
                        chatBody.prompt += '\n\n' + ARTIFACTS_PROMPT;
                    }

                    if (featureFlags.artifacts) {
                        const astFeatureOptions = message.data?.assistant?.definition?.featureOptions;
                        //option A
                            // either there is no options defined or there is and it needs to be true 
                            // not defined in cases of old ast used and when no assistant is in use 
                        // if ((!astFeatureOptions || astFeatureOptions.IncludeArtifactsInstr) && settings.featureOptions.includeArtifacts) {

                        //option B - either no feature option and user has the setting on 
                                    // or the assistant has it turned on
                        if ((!astFeatureOptions && settings.featureOptions.includeArtifacts) || (astFeatureOptions && astFeatureOptions.IncludeArtifactsInstr)) {
                             chatBody.prompt += '\n\n' + ARTIFACTS_PROMPT;
                             console.log("ARTIFACT PROMPT ADDED")
                        } 
                    }

                    if (uri) {
                        chatBody.endpoint = uri;
                    }

                    if (!featureFlags.codeInterpreterEnabled) {
                        //check if we need
                        options =  {...(options || {}), skipCodeInterpreter: true};
                    } else{
                        if (updatedConversation.codeInterpreterAssistantId) {
                            chatBody.codeInterpreterAssistantId = updatedConversation.codeInterpreterAssistantId;
                            options =  {...(options || {}), skipRag: true};
                        }
                    }

                    if (documents && documents.length > 0) {

                        const dataSources = documents.map((doc) => {
                            if (doc.key && doc.key.indexOf("://") === -1) {
                                return {id: "s3://" + doc.key, type: doc.type, name: doc.name || "", metadata: doc.metadata || {}};
                            } else if (doc.key && doc.key.indexOf("://") > -1) {
                                return {id: doc.key, type: doc.type, name: doc.name || "",metadata: doc.metadata || {}};
                            } else {
                                return doc;
                            }
                        });
                        chatBody.dataSources = dataSources;
                    } else if (message.data && message.data.dataSources && message.data.dataSources.length > 0) {
                        chatBody.dataSources = message.data.dataSources.map((doc: any) => {
                            return {id: doc.id, type: doc.type, name: doc.name || "", metadata: doc.metadata || {}};
                        });
                    }

                    if (selectedConversation && selectedConversation.tags) {
                        const tags = selectedConversation.tags;
                        if (tags.includes(ReservedTags.ASSISTANT_BUILDER)) {
                            // In assistants, this has the effect of
                            // disabling the use of documents so that we
                            // can just add the document to the list of documents
                            // the assistant is using.
                            options = {
                                ...(options || {}),
                                skipRag: true,
                                ragOnly: true
                            };
                        }
                    }

                    //PLUGINS 
                    if (plugin?.id === PluginID.CODE_INTERPRETER) {
                        options =  {...(options || {}), codeInterpreterOnly: true};
                        statsService.codeInterpreterInUseEvent();
                    } else if (plugin?.id === PluginID.NO_RAG) {
                        options = {
                            ...(options || {}),
                            skipRag: true,
                            ragOnly: false
                        };
                    } 
                    // else if (plugin?.id === PluginID.RAG_EVAL) {
                    //     //
                    // }
                

                    if (options) {
                        Object.assign(chatBody, options);
                    }

                    const parseMessageType = (message: string): {
                        prefix: "chat" | "json" | "json!" | "csv" | "fn";
                        body: string;
                        options: any | null
                    } => {
                        // This regular expression will match 'someXYZ' as a prefix and capture
                        // the contents inside the parentheses.
                        const regex = /^(\w+[\!]?)\(([^)]*)\).*/;

                        const match = message.trim().match(regex);

                        // @ts-ignore
                        //console.log("Match",match[0],match[1],match[2]);

                        if (match &&
                            match.length === 3 &&
                            match[1] &&
                            (match[1] === "json"
                                || match[1] === "json!"
                                || match[1] === "csv"
                                || match[1] === "fn") &&
                            match[2]) {
                            try {
                                return {
                                    prefix: match[1],
                                    body: message.trim().slice(match[1].length),
                                    options: match[2].length > 0 ? json5.parse(match[2]) : {}
                                };
                            } catch (e) {

                            }
                        }

                        return {prefix: "chat", body: message, options: {}}; // Return null if the message does not match the expected format
                    }

                    const controller = new AbortController();
                    try {

                        const {prefix, body, options} = parseMessageType(message.content);
                        let updated = {...message, content: body};
                        chatBody.messages = [...chatBody.messages.slice(0, -1), updated];

                        if(request.endpoint) {
                            chatBody.endpoint = request.endpoint;
                        }

                        console.log(`Prompt:`, {prefix: prefix, options, message});

                        const generateJsonLoose = (): Promise<Response> => {
                            if (options.length === 0) {
                                return sendJsonChatRequest(chatBody, controller.signal);
                            } else {
                                return sendJsonChatRequestWithSchemaLoose(chatBody, options as JsonSchema, controller.signal)
                            }
                        }

                        let outOfOrder = false;
                        let currentState = {};

                        const metaHandler: MetaHandler = {
                            status: (meta: any) => {
                                //console.log("Chat-Status: ", meta);
                                homeDispatch({type: "append", field: "status", value: newStatus(meta)})
                            },
                            mode: (modeName: string) => {
                                //console.log("Chat-Mode: "+modeName);
                                outOfOrder = (modeName === "out_of_order");
                            },
                            state: (state: any) => {
                                currentState = deepMerge(currentState, state);
                            },
                            shouldAbort: () => {
                                if (shouldAbort()) {
                                    controller.abort();
                                    return true;
                                }
                                return false;
                            }
                        };

                        const invokers = {
                            "fn": () => sendFunctionChatRequest(chatBody, options.functions as CustomFunction[], options.call, controller.signal, metaHandler),
                            "chat": () => sendChatRequest(chatBody, controller.signal, metaHandler),
                            "csv": () => sendCSVChatRequest(chatBody, options as ColumnsSpec, controller.signal, metaHandler),
                            "json": () => generateJsonLoose(),
                            "json!": () => sendJsonChatRequestWithSchema(chatBody, options as JsonSchema, controller.signal, metaHandler)
                        }

                        const response = (existingResponse) ?
                            existingResponse :
                            await invokers[prefix]();


                        if (!response || !response.ok) {
                            homeDispatch({field: 'loading', value: false});
                            homeDispatch({field: 'messageIsStreaming', value: false});
                            toast.error(response.statusText);
                            return;
                        }
                        const data = response.body;
                        if (!data) {
                            homeDispatch({field: 'loading', value: false});
                            homeDispatch({field: 'messageIsStreaming', value: false});
                            return;
                        }
                            homeDispatch({field: 'loading', value: false});
                            const reader = data.getReader();
                            const decoder = new TextDecoder();
                            let done = false;
                            let isFirst = true;
                            let text = '';
                            let codeInterpreterData = {};
                            // i find once a run on a thread is marked incomplete/failed/requires_action etc it will not work if you try again right away, better to just start with a new thread
                            let codeInterpreterNeedsNewThread = false;

                            // Reset the status display
                            homeDispatch({
                                field: 'status',
                                value: [],
                            });

                            const updatedMessages: Message[] = [
                                ...updatedConversation.messages,
                                newMessage({
                                    role: 'assistant',
                                    content: "",
                                    data: {state: currentState}
                                }),
                            ];
                            updatedConversation = {
                                ...updatedConversation,
                                messages: updatedMessages,
                            };
                            homeDispatch({
                                field: 'selectedConversation',
                                value: updatedConversation,
                            });


                            const eventOrderingMgr = new OutOfOrderResults();

                            while (!done) {
                                try {
                                    if (shouldAbort()) {
                                        controller.abort();
                                        done = true;
                                        break;
                                    }
                                    const {value, done: doneReading} = await reader.read();
                                    done = doneReading;
                                    const chunkValue = decoder.decode(value);

                                    if (!outOfOrder) {
                                        // check if codeInterpreterAssistantId
                                        const assistantIdMatch = chunkValue.match(/codeInterpreterAssistantId=(.*)/);
                                        const responseMatch = chunkValue.match(/codeInterpreterResponseData=(.*)/);

                                        if (assistantIdMatch) {
                                            const assistantIdExtracted = assistantIdMatch[1];
                                            //update conversation
                                            updatedConversation = {
                                                ...updatedConversation,
                                                codeInterpreterAssistantId: assistantIdExtracted
                                            };
                                            //move onto the next iteration
                                            continue;
                                        } else if (responseMatch) {
                                            //if we get a match we know its a json guaranteed
                                            const responseData = JSON.parse(responseMatch[1]);
                                            if (responseData['success'] && responseData['data'] && 'textContent' in responseData['data'].data) {
                                                codeInterpreterData = responseData['data'].data;
                                                text += responseData['data'].data.textContent;

                                            } else {
                                                console.log(responseData.error);
                                                if (responseData.error.includes("Error with run status")) codeInterpreterNeedsNewThread = true;
                                                text += "Something went wrong with code interpreter... please try again.";
                                            }

                                            continue;
                                        }

                                        text += chunkValue;
                                    } else {
                                        let event = {s: "0", d: chunkValue};
                                        try {
                                            event = JSON.parse(chunkValue);
                                        } catch (e) {
                                            //console.log("Error parsing event", e);
                                        }
                                        eventOrderingMgr.addEvent(event);
                                        text = eventOrderingMgr.getText();
                                    }

                                    const updatedMessages: Message[] =
                                        updatedConversation.messages.map((message, index) => {
                                            if (index === updatedConversation.messages.length - 1) {
                                                let assistantMessage =
                                                    { ...message,
                                                        content: text,
                                                        data: {...(message.data || {}), state: currentState}
                                                    };
                                                if (Object.keys(codeInterpreterData).length !== 0)  assistantMessage['codeInterpreterMessageData'] = codeInterpreterData;
                                                return assistantMessage
                                            }
                                            if (codeInterpreterNeedsNewThread && message.codeInterpreterMessageData && 'threadId' in message.codeInterpreterMessageData)  delete message.codeInterpreterMessageData.threadId
                                            return message;
                                        });
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: updatedMessages,
                                    };
                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });
                                } catch (error: any) {
                                    if (selectedConversation.isLocal) {
                                        const updatedConversations: Conversation[] = conversationsRef.current.map(
                                            (conversation:Conversation) => {
                                                if (conversation.id === selectedConversation.id) {
                                                    return conversationWithCompressedMessages(updatedConversation);
                                                }
                                                return conversation;
                                            },
                                        );
                                        if (updatedConversations.length === 0) {
                                            updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                                        }
                                        homeDispatch({field: 'conversations', value: updatedConversations});
                                        saveConversations(updatedConversations);
                                    } else {
                                        uploadConversation(updatedConversation, foldersRef.current);
                                    }
                                    homeDispatch({field: 'messageIsStreaming', value: false});
                                    homeDispatch({field: 'loading', value: false});
                                    homeDispatch({field: 'status', value: []});
                                    return;
                                }
                            }
                            // }

                            //console.log("Dispatching post procs: " + postProcessingCallbacks.length);
                            postProcessingCallbacks.forEach(callback => callback({
                                chatBody: chatBody,
                                response: text
                            }));

                            const hook = getHook(selectedConversation.tags || []);
                            if (hook) {

                                const result = hook.exec({}, selectedConversation, text);

                                let updatedText = (result && result.updatedContent) ? result.updatedContent : text;

                                const updatedMessages: Message[] =
                                    updatedConversation.messages.map((message, index) => {
                                        if (index === updatedConversation.messages.length - 1) {
                                            const disclaimer =  message.data.state.currentAssistantDisclaimer;
                                            let astMsg = updatedText;
                                            if (disclaimer) astMsg += "\n\n" + disclaimer

                                            return {
                                                ...message,
                                                content: astMsg,
                                            };
                                        }
                                        return message;
                                    });
                                updatedConversation = {
                                    ...updatedConversation,
                                    messages: updatedMessages,
                                };
                                homeDispatch({
                                    field: 'selectedConversation',
                                    value: updatedConversation,
                                });
                            }

                            if (selectedConversation.isLocal) {
                                const updatedConversations: Conversation[] = conversationsRef.current.map(
                                    (conversation:Conversation) => {
                                        if (conversation.id === selectedConversation.id) {
                                            return conversationWithCompressedMessages(updatedConversation);
                                        }
                                        return conversation;
                                    },
                                );
                                if (updatedConversations.length === 0) {
                                    updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                                }
                                homeDispatch({field: 'conversations', value: updatedConversations});
                                saveConversations(updatedConversations);
                            } else {
                                uploadConversation(updatedConversation, foldersRef.current);
                            }

                            homeDispatch({field: 'messageIsStreaming', value: false});

                            resolve(text);

                    } catch (error: any) {
                        homeDispatch({field: 'loading', value: false});
                        homeDispatch({field: 'messageIsStreaming', value: false});
                        homeDispatch({
                            field: 'status',
                            value: [],
                        });
                        return;
                        //reject(error);
                        // Handle any other errors, as required.
                    }
                    
                    //Reset the status display
                    homeDispatch({
                        field: 'status',
                        value: [],
                    });
                }
            });
        },
        [
            conversationsRef.current,
            selectedConversation
        ],
    );

    return {
        handleSend
    };
}
