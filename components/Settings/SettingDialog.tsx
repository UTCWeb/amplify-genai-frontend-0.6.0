import { FC, useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { featureOptionFlags, getSettings, modelOptionFlags, saveSettings } from '@/utils/app/settings';

import { Settings, Theme } from '@/types/settings';

import HomeContext from '@/pages/api/home/home.context';
import React from 'react';
import { StorageDialog } from './StorageDialog';
import FlagsMap from '../Promptbar/components/FlagsMap';
import { Modal } from '../ReusableComponents/Modal';
import { saveUserSettings } from '@/services/settingsService';
import { MINIMAL_AVAILABLE_MODELS } from '@/utils/app/models';
import { Model } from '@/types/model';
import cloneDeep from 'lodash/cloneDeep';


  
  
  interface Props {
  open: boolean;
  onClose: () => void;
}



export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const { dispatch: homeDispatch, state:{statsService, featureFlags, models} } = useContext(HomeContext);
  const initSettings: Settings = getSettings(featureFlags);
  const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(initSettings.featureOptions);
  const [modelOptions, setModelOptions] = useState<{ [key: string]: boolean }>(initSettings.modelOptions);
  const [theme, setTheme] = useState<Theme>(initSettings.theme); 
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  
  useEffect(() => {
    if (open) statsService.openSettingsEvent();
  }, [open])

  useEffect(()=> {

    const hasChanges = theme !== initSettings.theme || 
                       JSON.stringify(featureOptions) !== JSON.stringify(initSettings.featureOptions) ||
                       JSON.stringify(modelOptions) !== JSON.stringify(initSettings.modelOptions);
    setHasUnsavedChanges(hasChanges);

  }, [theme, featureOptions, modelOptions])

//this code added 3/6/2025 to ensure the dark mode option is selected.
  useEffect(() => {
      setTheme('dark'); 
      homeDispatch({ field: 'lightMode', value: 'dark' });
  }, []);
  

  const handleSave = async () => {
    if (theme !== initSettings.theme) statsService.setThemeEvent(theme);
    homeDispatch({ field: 'lightMode', value: theme });
    console.log(featureOptions);
    console.log(modelOptions);


    const updatedSettings: Settings = { theme: theme, 
                                        featureOptions: featureOptions, 
                                        modelOptions: modelOptions
                                      }
    statsService.saveSettingsEvent(updatedSettings);
    console.log(updatedSettings);
    saveSettings(updatedSettings);
    onClose();

   const result = await saveUserSettings(updatedSettings);
    if (!result) alert("Settings failed to update in the cloud at the time. However, your changes have been saved and applied locally within this browser. ");
  
    
  };

  const inDefaultModelList = (modelId: string) => {
    return cloneDeep(MINIMAL_AVAILABLE_MODELS).map((model: Model) => model.id).includes(modelId)
  }


  const getAvailableModels = () => {
    const sortedModels = models.reduce((accumulator: { anthropic: any[], mistral: any[], gpt: any[] }, model: Model) => {
        if (model.id.includes('anthropic')) {
            accumulator.anthropic.push({ id: model.id, name: model.name });
        } else if (model.id.startsWith('mistral')) {
            accumulator.mistral.push({ id: model.id, name: model.name });
        } else if (model.id.startsWith('gpt')) {
            accumulator.gpt.push({ id: model.id, name: model.name });
        }
        return accumulator;
    }, { anthropic: [], mistral: [], gpt: [] });

    // Sort each list by model.name.length in descending order
    sortedModels.anthropic.sort((a, b) => b.name.length - a.name.length);
    sortedModels.mistral.sort((a, b) => b.name.length - a.name.length);
    sortedModels.gpt.sort((a, b) => b.name.length - a.name.length);

    return sortedModels;
}

const availableModels = getAvailableModels();

const modelLabel = (id: string, name: string) => {
  return <div key={id} className={` text-sm ${inDefaultModelList(id) ? "text-blue-600":""}`}> {name} </div>
}

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return <Modal 
      width={window.innerWidth * 0.62}
      height={window.innerHeight * 0.88}
      title={`Settings${hasUnsavedChanges ? " * " : ""}`}
      onCancel={() => onClose()} 
      onSubmit={() => handleSave()
      }
      submitLabel={"Save"}
      content={
        <>
            <div className="flex flex-row text-lg font-bold mb-2 text-black dark:text-neutral-200">
              {t('Theme')}
            </div>

            <div className="flex flex-row gap-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={(event) => {
                    setTheme(event.target.value as Theme);
                  }}
                  className="form-radio cursor-pointer"
                />
                <span className="ml-2 text-neutral-700 dark:text-neutral-200">{t('Dark mode')}</span>
              </label>
                    
              <label className="flex items-center">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={(event) => {
                    setTheme(event.target.value as Theme);
                  }}
                  className="form-radio cursor-pointer"
                />
                <span className="ml-2 text-neutral-700 dark:text-neutral-200">{t('Light mode')}</span>
              </label>
            </div>

            {featureFlags.storeCloudConversations && 
              <StorageDialog open={open} />
            }

            <div className="mt-2 text-lg font-bold text-black dark:text-neutral-200">
              {t('Models')}
            </div>


            
              <div className='flex flex-row w-full'>
                    <label className='ml-5 mt-[12px] text-[0.75rem]'>Include All</label>
                    <div className='flex-grow'>
                      <div className='flex flex-col text-center mt-[-4px]'> Available Models 
                          <label className='ml-2 text-xs mb-2 mt-[-4px]'>{"(Default models are shown in blue)"}</label>
                      </div>
                    </div> 
              </div>      
            <div className='flex flex-row'>
              <div className='w-[96px] border border-gray-300 mr-[-1px]  mt-[-2px] dark:border-neutral-700 px-2'>
              <div className='mt-1'>
                <FlagsMap 
                  id={'modelOptionFlags'}
                  flags={modelOptionFlags}
                  state={modelOptions}
                  flagChanged={(key, value) => {
                    setModelOptions({...modelOptions, [key]: value});
                  }}
                /> 
                </div> 
              </div>
              <table className="mt-[-2px] flex-grow mr-4 overflow-x-auto table-auto border-collapse border border-gray-300 dark:border-neutral-700">
                <tbody>
                  {/* OpenAI Models */}
                  <tr>
                    {/* <td className="text-[1.1rem] px-4 py-2 border border-gray-300 dark:border-neutral-700">OpenAI</td> */}
                    {availableModels.gpt.map((m: { id: string; name: string }) => (
                      <td key={m.id} className="px-4 border border-gray-300 dark:border-neutral-700">
                        {modelLabel(m.id, m.name)}
                      </td>
                    ))}
                  </tr>

                  {/* Claude Models */}
                  <tr>
                    {/* <td className="text-[1.1rem] px-4 py-2 border border-gray-300 dark:border-neutral-700">Claude</td> */}
                    {availableModels.anthropic.map((m: { id: string; name: string }) => (
                      <td key={m.id} className="px-4 border border-gray-300 dark:border-neutral-700">
                        {modelLabel(m.id, m.name)}
                      </td>
                    ))}
                  </tr>

                  {/* Mistral Models */}
                  <tr>
                    {/* <td className="text-[1.1rem] px-4 py-2 border border-gray-300 dark:border-neutral-700">Mistral</td> */}
                    {availableModels.mistral.map((m: { id: string; name: string }) => (
                      <td key={m.id} className="px-4 border border-gray-300 dark:border-neutral-700">
                        {modelLabel(m.id, m.name)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
                  

            <div className="mt-4 text-lg font-bold text-black dark:text-neutral-200">
              {t('Features')}
            </div>

            <FlagsMap 
              id={'featureOptionFlags'}
              flags={featureOptionFlags}
              state={featureOptions}
              flagChanged={(key, value) => {
                setFeatureOptions({...featureOptions, [key]: value});
              }}
            />
          
        </>
      }
    />
                
};



