import Ajv from 'ajv';
import ajvBsontype from 'ajv-bsontype';
import type {Db} from 'mongodb';

export function isDocumentFailedValidationError(error: Error & {code?: number}) {
  return error.code === 121;
}

export class MongodbSchemaDocumentValidator {
  #ajv: Ajv.Ajv;
  #db: Db;
  #wasInitialized = false;
  
  constructor(db: Db, ajv: Ajv.Ajv = new Ajv()) {
    ajvBsontype(ajv);
    this.#ajv = ajv;
    this.#db = db;
  }

  initialize = async (): Promise<void> => {
    const collections = await this.#db.command({listCollections: 1});
    collections.cursor.firstBatch
      .filter(isCollectionWithSchema)
      .forEach((collection: CollectionWithSchema) => {
        this.#ajv.addSchema(collection.options.validator.$jsonSchema, collection.name);
      });
    this.#wasInitialized = true;
  }

  validate = (name: string | PathRef, document: Object): ValidationResult => {
    this.#requireInitialized();
    const isValid = Boolean(this.#ajv.validate(name, document));
    return {isValid, errors: this.#ajv.errors, errorsText: this.#ajv.errorsText()};
  }

  #requireInitialized = (): void => {
    if (!this.#wasInitialized) {
      throw new Error('Attempt to use MongoDB schema document validator without initialization');
    }
  }
}

export type ValidationResult = {
  isValid: boolean;
  errors?: Ajv.ErrorObject[] | null;
  errorsText?: string;
}

export type PathRef = {
  $ref: string;
}

function isCollectionWithSchema(batchItem: BatchItem): batchItem is CollectionWithSchema {
  return batchItem.type === 'collection' && Boolean(batchItem.options.validator?.$jsonSchema);
}

type BatchItem = {
  type: string;
  name: string;
  options: {
    validator?: {
      $jsonSchema: Object;
    }
  }
}

type CollectionWithSchema = {
  type: 'collection';
  name: string;
  options: {
    validator: {
      $jsonSchema: Object;
    }
  }
} 
