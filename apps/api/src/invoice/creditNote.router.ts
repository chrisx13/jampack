import { SALES_DOCS } from '@jampack/domain';
import { makeSalesRouter } from './salesRouter';

export const creditNoteRouter = makeSalesRouter(SALES_DOCS.avoir);
