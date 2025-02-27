import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { FolderInterface} from '@/types/folder';
import { Model, ModelID } from '@/types/model';
import { Prompt } from '@/types/prompt';
import { WorkflowDefinition } from "@/types/workflow";
import { Status } from "@/types/workflow";
import { Workspace } from "@/types/workspace";
import { v4 as uuidv4 } from 'uuid';
import { Assistant } from "@/types/assistant";
import { noOpStatsServices, StatsServices } from "@/types/stats";
import { Account } from "@/types/accounts";
import {Op} from "@/types/op";
import {CheckItemType} from "@/types/checkItem";
import { PluginLocation } from '@/types/plugin';
import { Group } from '@/types/groups';
import { Artifact } from '@/types/artifacts';


type HandleSend = (request: any) => void;

export interface HomeInitialState {
  defaultAccount: Account | undefined;
  chatEndpoint: string | null;
  conversationStateId: string;
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  artifactIsStreaming: boolean
  modelError: ErrorMessage | null;
  status: Status[];
  models: Model[];
  folders: FolderInterface[];
  conversations: Conversation[];
  artifacts: any[];
  workflows: WorkflowDefinition[];
  selectedConversation: Conversation | undefined;
  currentMessage: Message | undefined;
  selectedArtifacts: Artifact[] | undefined;
  prompts: Prompt[];
  temperature: number;
  showChatbar: boolean;
  showPromptbar: boolean;
  workspaceDirty: boolean;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  defaultModelId: ModelID | undefined;
  featureFlags: { [key: string]: boolean },
  workspaceMetadata: Workspace;
  selectedAssistant: Assistant | null;
  page: string;
  defaultFunctionCallModel: string | null;
  statsService: StatsServices;
  currentRequestId: string | null;
  latestDataDisclosureUrlPDF: string;
  latestDataDisclosureHTML: string;
  inputEmail: string;
  hasAcceptedDataDisclosure: boolean | null;
  hasScrolledToBottom: boolean;
  storageSelection: string | null;
  ops: { [key: string]: Op };
  allFoldersOpenConvs: boolean;
  allFoldersOpenPrompts: boolean;
  checkedItems: Array<any>;
  checkingItemType: CheckItemType | null;
  pluginLocation: PluginLocation;
  groups: Group[];
  syncingConversations: boolean;
  syncingPrompts: boolean;

}

export const initialState: HomeInitialState = {
  defaultAccount: undefined,
  chatEndpoint: null,
  conversationStateId: "init",
  loading: false,
  lightMode: 'dark',
  status: [],
  workspaceDirty: false,
  messageIsStreaming: false,
  artifactIsStreaming: false,
  modelError: null,
  models: [],
  folders: [],
  conversations: [],
  artifacts:[], // for saved/remote artifacts
  workflows: [],
  ops: {},
  workspaceMetadata: {
    name: '',
    description: '',
    id: uuidv4(),
    // populate with date tiem string in iso format
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    tags: [],
    data: {},
  },
  selectedConversation: undefined,
  currentMessage: undefined,
  selectedArtifacts: undefined,
  prompts: [],
  temperature: 1,
  showPromptbar: true,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  defaultModelId: undefined,
  selectedAssistant: null,
  page: 'chat',
  currentRequestId: null,

  featureFlags: {
    assistantsEnabled: true,
    promptOptimizer: true,
    ragEnabled: true,
    sourcesEnabled: true,
    uploadDocuments: true,
    assistantCreator: true,
    assistants: true,
    overrideUneditablePrompts: false,
    overrideInvisiblePrompts: false,
    extractDocumentsLocally: false,
    enableMarket: false,
    promptPrefixCreate: false,
    outputTransformerCreate: false,
    workflowRun: true,
    workflowCreate: false,
    rootPromptCreate: true,
    pluginsOnInput: true, // if all plugin features are disables, then this should be disabled. ex. ragEnabled, codeInterpreterEnabled etc.
    dataSourceSelectorOnInput: true,
    followUpCreate: true,
    marketItemDelete: false,
    automation: true,
    codeInterpreterEnabled: true,
    dataDisclosure: false,
    storeCloudConversations: true,
    qiSummary: false,
    apiKeys: true,
    assistantAdminInterface: false,
    artifacts: true,
    mtdCost: true,
    highlighter: true,
    assistantAPIs: false
  },

  statsService: noOpStatsServices,
  defaultFunctionCallModel: null,
  latestDataDisclosureUrlPDF: '',
  latestDataDisclosureHTML: '',
  inputEmail: '',
  hasAcceptedDataDisclosure: null,
  hasScrolledToBottom: false,
  storageSelection: null,
  allFoldersOpenConvs: false,
  allFoldersOpenPrompts: false,
  checkedItems: [],
  checkingItemType: null,
  pluginLocation: {x:100, y:-250},
  groups: [],
  syncingConversations: true,
  syncingPrompts: true
};
