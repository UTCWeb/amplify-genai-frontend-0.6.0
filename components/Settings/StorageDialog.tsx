import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconCloud, IconMessage,
    IconCloudFilled
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { handleStorageSelection, saveStorageSettings } from '@/utils/app/conversationStorage';
import { ConversationStorage } from "@/types/conversationStorage";
import { saveConversations } from '@/utils/app/conversation';
import React from 'react';
import { InfoBox } from '../ReusableComponents/InfoBox';



interface Props {
  open: boolean;
}


export const StorageDialog: FC<Props> = ({ open }) => {

  const { dispatch: homeDispatch, state:{conversations, selectedConversation, folders, statsService, storageSelection} } = useContext(HomeContext);

  const storageRef = useRef(storageSelection);

  useEffect(() => {
    storageRef.current = storageSelection;
  }, [storageSelection]);

  const [selectedOption, setSelectedOption] = useState( storageRef.current || '');

  const { t } = useTranslation('conversationStorage');

  

  const conversationsRef = useRef(conversations);

  useEffect(() => {
      conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);



  const handleSave = async () => {
    saveStorageSettings({ storageLocation: selectedOption } as ConversationStorage);
    homeDispatch({field: 'storageSelection', value: selectedOption});

    const updatedConversations = await handleStorageSelection(selectedOption, conversationsRef.current, foldersRef.current, statsService);
    if (updatedConversations) {
      homeDispatch({field: 'conversations', value: updatedConversations});
      saveConversations(updatedConversations);
      if (selectedConversation) {
        const updateSelected = updatedConversations.find((c) => c.id === selectedConversation.id);
        homeDispatch({field: 'selectedConversation', value: updateSelected});
      }
    }
    
  };
  
  const confirmationMessage = () => {
    switch (selectedOption) {
      case 'local-only':
        return "Any conversations stored in the cloud will be moved locally to your browser. All conversations created in the future will be stored locally.";
      case 'cloud-only':
        return "Any conversations stored locally will be moved to the cloud. All conversations created in the future will automatically be uploaded to the cloud.";
      case 'future-local':
        return "Only new conversations will be stored locally. Existing conversations will remain where they are currently stored.";
      case 'future-cloud':
        return "Only new conversations will be uploaded to the cloud. Existing conversations will remain where they are currently stored.";
    }
  }

  return ( open ? (
          <div
            className="inline-block transform overflow-y-auto rounded-lg  bg-transparent text-left align-bottom transition-all sm:mt-6  sm:align-middle"
          >
            <div className="text-lg pb-2 font-bold text-black dark:text-neutral-200 flex items-center">
              {t('Conversation Storage')}
            </div>

            <InfoBox
              content = {
                <span className="ml-2 text-xs"> 
                {"These are default settings that could be manually overwritten at the conversation level as indicated by the cloud icon."}
                <br className='mb-2'></br>
                {"If you are concerned with privacy, you can store your conversations locally, but they will not be available across multiple devices or browsers."}
                <div className='mt-1 text-black dark:text-neutral-300 text-sm text-center'> {"*** This configuration applies to the current browser only ***"} </div>
                </span>
              }
            />


            <div className="flex flex-row text-sm font-bold mt-4 text-black dark:text-neutral-200">
              {t('Where would you like to store your conversations?')}
              <button
                type="button"
                title='Apply Conversation Storage Changes To The Current Browser'
                className="text-xs ml-10 p-2 py-1 mt-2  border rounded-lg shadow-md focus:outline-none border-neutral-800 bg-neutral-100 text-black hover:bg-neutral-200"
                onClick={() => {
                    if (confirm(`${confirmationMessage()} \n\n Would you like to continue?`)) handleSave();
                }}
                >
                {t('Apply Changes')}
                </button>
            </div>

        <form className='mt-[-20px]'>
          {/* Local Storage Section */}
          <div className="mb-4">
              <div className="mt-4 pb-1 border-b border-gray-300">
                  <label className="text-base font-semibold" title='Local storage keeps your conversations only in this browser, ensuring they remain private.' >Local Storage</label>
                  <button
                      type="button"
                      className="ml-0.8 bg-transparent border-none " 
                      disabled
                      title='Local storage keeps your conversations only in this browser, ensuring they remain private.'
                      >
                      <IconMessage className='ml-2' size={18} style={{ marginBottom: '-4px' }} />
                    </button>
              </div>
              <div className="mt-2 mb-2">
                  <input
                      type="radio"
                      id="local-only"
                      name="storageOption"
                      value="local-only"
                      checked={selectedOption === 'local-only'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="local-only"> Store all existing and new conversations locally </label>
              </div>
              <div className="mb-1">
                  <input
                      type="radio"
                      id="future-local"
                      name="storageOption"
                      value="future-local"
                      checked={selectedOption === 'future-local'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="future-local"> Store only new conversations locally</label>
              </div>
          </div>

          {/* Cloud Storage Section */}
          <div className="mb-4">
              <div className="pb-1 border-b border-gray-300">
                  <label className="text-base font-semibold" title="Cloud storage allows access to your conversations from any device.">Cloud Storage</label>
                  <button
                      type="button"
                      className="ml-0.8 bg-transparent border-none " 
                      disabled
                      title='Cloud storage allows access to your conversations from any device.'
                      >
                      <div className='ml-2' style={{ marginBottom: '-4px' }} >
                        <IconCloud className="block dark:hidden" size={20} />
                        <IconCloudFilled className="hidden dark:block dark:text-neutral-200" size={20} />
                      </div>
                    </button>
              </div>
              <div className="mt-2  mb-2">
                  <input
                      type="radio"
                      id="cloud-only"
                      name="storageOption"
                      value="cloud-only"
                      checked={selectedOption === 'cloud-only'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="cloud-only"> Store all existing and new conversations in the cloud</label>
              </div>
              <div>
                  <input
                      type="radio"
                      id="future-cloud"
                      name="storageOption"
                      value="future-cloud"
                      checked={selectedOption === 'future-cloud'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="future-cloud"> Store only new conversations in the cloud</label>
              </div>
          </div>
        </form>
      </div>
       
  ) : <></>)
};
