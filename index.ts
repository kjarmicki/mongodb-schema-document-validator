export {MongodbSchemaDocumentValidator} from './mongodb-schema-document-validator';
export function isDocumentFailedValidationError(error: Error & {code?: number}) {
  return error.code === 121;
}
