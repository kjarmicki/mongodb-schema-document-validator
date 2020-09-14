import assert from 'assert';
import * as uuid from 'uuid';
import Ajv from 'ajv';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient} from 'mongodb';
import {MongodbSchemaDocumentValidator} from '../mongodb-schema-document-validator';

const TEST_MONGO_VERSIONS = ['4.4.0', '3.6.19'];

async function setupMongodbServer(dbName: string, version: string): Promise<MongoMemoryServer> {
  const server = new MongoMemoryServer({
    instance: {
      dbName
    },
    binary: {
      version
    },
    autoStart: false
  });
  await server.start();
  return server;
}

async function setupMongodbClient(server: MongoMemoryServer): Promise<MongoClient> {
  const client = new MongoClient(await server.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await client.connect();
  return client;
}

TEST_MONGO_VERSIONS.forEach((mongodbVersion) => {
  describe(`MongoDB schema document validator (using mongo v${mongodbVersion})`, () => {
    let client: MongoClient;
    let server: MongoMemoryServer;
    let dbName = uuid.v4();

    before(async function() {
      this.timeout(1000 * 60 * 10); // in case particular MongoDB version needs to be downloaded
      server = await setupMongodbServer(dbName, mongodbVersion);
      client = await setupMongodbClient(server);
    });

    after(async () => {
      await client.close(true);
      await server.stop();
    });

    it('should be able to validate the document using MongoDB schema', async () => {
      const db = client.db(dbName);
      const collectionName = uuid.v4();

      await db.createCollection(collectionName, {
        validationLevel: 'strict',
        validationAction: 'error',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'year'],
            properties: {
              name: {
                bsonType: 'string',
                description: 'must be a string and is required'
              },
              year: {
                bsonType: 'int',
                minimum: 2017,
                maximum: 3017,
                description: 'must be an integer in [ 2017, 3017 ] and is required'
              },
            }
          }
        }
      });

      const validator = new MongodbSchemaDocumentValidator(db);
      await validator.initialize();
      const data = {};

      const result = validator.validate(collectionName, data);
      assert.deepStrictEqual(result, {
        isValid: false,
        errors: [{
          keyword: 'required',
          dataPath: '',
          schemaPath: '#/required',
          params: {
            missingProperty: 'name'
          },
          message: "should have required property 'name'"
        }],
        errorsText: "data should have required property 'name'"
      });

      await assert.rejects(() => db.collection(collectionName).insertOne(data), {
        code: 121
      });
    });

    it('should make it possible to use custom Ajv instance', async () => {
      const db = client.db(dbName);
      const collectionName = uuid.v4();

      await db.createCollection(collectionName, {
        validationLevel: 'strict',
        validationAction: 'error',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'year'],
            properties: {
              name: {
                bsonType: 'string',
                description: 'must be a string and is required'
              },
              year: {
                bsonType: 'int',
                minimum: 2017,
                maximum: 3017,
                description: 'must be an integer in [ 2017, 3017 ] and is required'
              },
            }
          }
        }
      });

      const validator = new MongodbSchemaDocumentValidator(db, new Ajv({
        allErrors: true
      }));
      await validator.initialize();

      const data = {};
      const result = validator.validate(collectionName, data);
      assert.deepStrictEqual(result, {
        isValid: false,
        errors: [{
          keyword: 'required',
          dataPath: '',
          schemaPath: '#/required',
          params: {
            missingProperty: 'name'
          },
          message: "should have required property 'name'"
        }, {
          keyword: 'required',
          dataPath: '',
          schemaPath: '#/required',
          params: {
            missingProperty: 'year'
          },
          message: "should have required property 'year'"
        }],
        errorsText: "data should have required property 'name', data should have required property 'year'"
      });

      await assert.rejects(() => db.collection(collectionName).insertOne(data), {
        code: 121
      });
    });
  });
});
