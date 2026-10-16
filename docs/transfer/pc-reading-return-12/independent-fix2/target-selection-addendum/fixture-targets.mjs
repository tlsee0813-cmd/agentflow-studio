import * as D from '../../product12-candidate-fix2/app/continuity/dist/public/shared/domain.js';
import {parseProject} from '../../product12-candidate-fix2/app/continuity/dist/public/shared/validation.js';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
for(const name of ['direct','other']) {
 let p=JSON.parse(readFileSync(new URL('../independent/'+name+'.json',import.meta.url),'utf8'));let ids=JSON.parse(readFileSync(new URL('../independent/'+name+'-ids.json',import.meta.url),'utf8'));
 for(const id of [ids.A,ids.B])p=D.markHandoff(p,id,D.handoffText(p,id),'download');
 parseProject(JSON.stringify(p));writeFileSync(new URL(name+'.json',import.meta.url),JSON.stringify(p,null,2));copyFileSync(new URL('../independent/'+name+'-ids.json',import.meta.url),new URL(name+'-ids.json',import.meta.url));
}
for(const n of ['boundary.json','boundary-ids.json'])copyFileSync(new URL('../independent/'+n,import.meta.url),new URL(n,import.meta.url));
