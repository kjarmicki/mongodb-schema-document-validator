# MongoDB Schema Document Validator

Have you ever been losing your mind over that annoyingly vague `Document failed validation` error
while trying to figure out which of the document properties are acutally causing it?

If so, despair no more because this module is designed to help exactly with that.

## Usage

You first need to create and initialize the validator object with db object *after* the validation rules
have been set up. Then you can use the validator giving it a collection name and a document you'd like to validate.

Example:
```js
const {MongoClient} = require('mongodb');
const {MongodbSchemaDocumentValidator, isDocumentFailedValidationError} = require('mongodb-schema-document-validator');

const mongoClient = new MongoClient('mongodb://company');
await mongoClient.connect();

const db = mongoClient.db('staff');
await db.createCollection('developers', {
  validationLevel: 'strict',
  validationAction: 'error',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'must be a string and is required'
        }
      }
    }
  }
});

const validator = new MongodbSchemaDocumentValidator(db);
await validator.initialize(); // remember that initalize has to be called after the schema is attached to the collection

const collection = db.collection('developers');
const newDeveloper = {
  naem: 'this property has a typo'
};
try {
  await collection.insert(newDeveloper);
} catch (error) {
  if (isDocumentFailedValidationError(error)) {
    const validation = validator.validate('developers', newDeveloper);
    console.log(validation);
  }
}
```
This will output
```js
{
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
}
```
which should point you in the right direction towards solving your problem.

## Custom validation options

This module uses [Ajv](https://www.npmjs.com/package/ajv) under the hood and you can configure it using
[its options](https://www.npmjs.com/package/ajv#options). In order to use your custom configured Ajv instead
of the default one, pass it as a second argument to the constructor:

```js
const validator = new MongodbSchemaDocumentValidator(db, new Ajv({
  allErrors: true
}));
```

At the moment of writing this module is known to work well with Ajv version `6.12.4`.
