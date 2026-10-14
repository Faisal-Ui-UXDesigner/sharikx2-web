import {createThemeController} from './theme.js';
let storage=null;try{storage=window.localStorage;}catch{}
// The head script and application share this singleton module instance.
export const themeController=createThemeController({document,storage});
