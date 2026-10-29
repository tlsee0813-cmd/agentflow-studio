// AF124: the Worker of the limited existing-map release. Same studio handler and assets routing as worker.mjs, with the
// existing-map policy fixed here: no map reading of any schema and no map jobs (see RELEASE_POLICIES in studio.mjs).
import { studioWorker } from './worker.mjs';
export default studioWorker('existing-map');
