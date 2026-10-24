import {startPreviewServer} from './preview-server.mjs';
const preview=await startPreviewServer({root:process.cwd(),port:4173});
console.log(`Preview ${preview.origin}`);
