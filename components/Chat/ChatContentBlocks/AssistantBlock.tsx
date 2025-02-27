import {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconRobot} from "@tabler/icons-react";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {createAssistant} from "@/services/assistantService";
import { useSession } from "next-auth/react"
import {AssistantDefinition, AssistantProviderID} from "@/types/assistant";
import {Conversation} from "@/types/chat";
import { createAssistantPrompt, handleUpdateAssistantPrompt} from "@/utils/app/assistants";
import toast from "react-hot-toast";
import React from "react";


interface AssistantProps {
    definition: string;
}


const AssistantBlock: React.FC<AssistantProps> = ({definition}) => {
    const [error, setError] = useState<string | null>(null);
    const [isIncomplete, setIsIncomplete] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [assistantName, setAssistantName] = useState<string>("");
    const [assistantDefinition, setAssistantDefinition] = useState<AssistantDefinition|null>(null);
    const [assistantInstructions, setAssistantInstructions] = useState<string>("");
    const [assistantDescription, setAssistantDescription] = useState<string>("");
    const [assistantTools, setAssistantTools] = useState<string[]>([]);
    const [assistantTags, setAssistantTags] = useState<string[]>([]);
    const [assistantDocuments, setAssistantDocuments] = useState<string[]>([]);

    const {state:{selectedConversation, statsService, messageIsStreaming, prompts},  dispatch:homeDispatch} = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user;

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const getDocumentsInConversation = (conversation?:Conversation) => {
        if(conversation){
            // Go through every message in the conversation and collect all of the
            // data sources that are in the data field of the messages
            return conversation.messages.filter( m => {
                return m.data && m.data.dataSources
            })
                .flatMap(m => m.data.dataSources);
        }

        return [];
    }

    function parsePrefixedLines(text: string): {[key:string]:string} {
        if (typeof text !== 'string' || text.length === 0) {
            throw new Error('Input text must be a non-empty string');
        }

        const resultMap:{[key:string]:string} = {};
        const lines: string[] = text.split('\n');
        let currentPrefix: string | null = null;
        const contentBuffer: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line: string = lines[i].trim();
            const match: RegExpMatchArray | null = line.match(/^(\s*"?(\w+)"?\s*):(.*)$/);
            if (match) {
                // When a new prefix is found, save the previous prefix and its content
                if (currentPrefix !== null) {
                    resultMap[currentPrefix] =
                        contentBuffer.join('\n');
                }
                // Extract current prefix from the regex match, removing quotes if present
                currentPrefix = match[2].replaceAll('"', '');
                contentBuffer.push(match[3]);
            } else if (currentPrefix !== null) {
                // If we are in a prefixed block, accumulate the content
                contentBuffer.push(line);
            }
        }

        // When the input ends, save the last prefix and its content
        if (currentPrefix !== null) {
            resultMap[currentPrefix] = contentBuffer.join('\n');
        }

        return resultMap;
    }

    const parseAssistant = (definitionStr: string) => {

        try {

            let definition = null;
            try{
                definition = JSON.parse(definitionStr);
            }
            catch(e) {
                definition = parsePrefixedLines(definitionStr);
            }

            if(definition.name){
                definition.name = definition.name.replace(/[^a-zA-Z0-9]+/g, '').trim();
            }
            if(!definition.instructions && definition.description) {
                definition.instructions = definition.description;
            }
            else if(!definition.instructions) {
                definition.instructions = definitionStr;
            }

            if(typeof definition.instructions !== "string") {
                definition.instructions = JSON.stringify(definition.instructions);
            }

            definition.provider = AssistantProviderID.AMPLIFY;
            definition.tags = [];
            definition.tools = [];

            const rawDS = getDocumentsInConversation(selectedConversation);
            const knowledge = rawDS.map(ds => {
                if(ds.key || (ds.id && ds.id.indexOf("://") > 0)){
                    return ds;
                }
                else {
                    return {
                        ...ds,
                        id: "s3://"+ds.id
                    }
                }
            });

            definition.dataSources = knowledge;
            definition.data = {};
            definition.data.access = {read: true, write:true};

            return definition;
        } catch (e) {
            setIsIncomplete(true);
            return {
            };
        }
    }



    const handleCreateAssistant = async () => {

        if(user?.email && assistantDefinition) {

            setLoadingMessage("Creating assistant...");
            setIsLoading(true);

            try {
                const {id,assistantId,provider} = await createAssistant(assistantDefinition);

                // console.log("assistantId", assistantId);
                // console.log("provider", provider);
                
                assistantDefinition.id = id;
                assistantDefinition.provider = provider;
                assistantDefinition.assistantId = assistantId;


                if(assistantId) {
                    toast("Assistant created successfully!");
                    const createdAssistantPrompt = createAssistantPrompt(assistantDefinition);
                    handleUpdateAssistantPrompt(createdAssistantPrompt, prompts, homeDispatch);
                    statsService.createPromptEvent(createdAssistantPrompt);
                } else {
                    alert("Failed to create assistant. Please try again.");
                }
            } catch (e) {
                alert("Failed to create assistant. Please try again.");
            }

            setLoadingMessage("");
            setIsLoading(false);
        }
    }


    useEffect(() => {
        if(!messageIsStreaming) {
            const assistant = parseAssistant(definition) as AssistantDefinition;

            if(assistant.name && assistant.description && assistant.instructions) {
                setIsIncomplete(false);
            }

            setAssistantName(assistant.name);
            setAssistantInstructions(assistant.instructions);
            setAssistantDescription(assistant.description);
            setAssistantDefinition(assistant);
            setIsLoading(false);
        }
    }, [messageIsStreaming]);

    let dataSources = getDocumentsInConversation(selectedConversation);

    // @ts-ignore
    return error ?
        <div>{error}</div> :
        isIncomplete ? <div>We are making progress on your assistant.</div> :
        <div style={{maxHeight: "450px"}}>
            {isLoading ? (
                <div className="flex flex-row items-center"><LoadingIcon/> <div className="ml-2">{loadingMessage}</div></div>
            ) : (
                <>
                    <div className="flex flex-col w-full mb-4 overflow-x-hidden gap-0.5">
                        <div className="flex flex-row items-center justify-center">
                            <div className="mr-2"><IconRobot size={30} /></div>
                            <div className="text-2xl font-bold">{assistantName}</div>
                        </div>

                        <div style={{ width: '99%' }}>
                            <ExpansionComponent title={"Description"} content={
                                <div style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
                                     className="mb-2 max-h-24 overflow-y-auto text-sm text-gray-500">
                                        {assistantDescription}
                                    </div>
                                }/>
                        </div>

                        <div style={{ width: '99%' }}>
                            <ExpansionComponent title={"Instructions"} content={
                                <div  style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }} 
                                      className="mb-2 max-h-24 overflow-y-auto text-sm text-gray-500">
                                        {assistantInstructions}
                                    </div>
                                }/>
                        </div>
                        
                        {dataSources.length > 0 ?
                            <ExpansionComponent title={"Data Sources"} content={
                                <div>
                                    <div className="text-sm text-gray-500 max-h-24 overflow-y-auto">
                                        {dataSources.map((source, index) => {
                                            return <div key={index}>{source.name}</div>
                                        })}
                                    </div>
                                </div>
                            }/> : <div className="ml-2">No data sources attached</div>
                        }
                        <button className="mt-4 w-full px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                                onClick={handleCreateAssistant}
                        >
                            Create Assistant
                        </button>
                    </div>
                </>
            )}
        </div>;
};

export default AssistantBlock;


