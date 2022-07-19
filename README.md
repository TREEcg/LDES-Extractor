# Linked Data Event Stream extraction package

This package facilitates creating a(n) **timeframe/extract** of a **versioned** Linked Data Event Stream ([LDES](https://semiceu.github.io/LinkedDataEventStreams/)) and is based on the [snapshot package](https://github.com/TREEcg/LDES-Snapshot)

### 🔧 Configuring the extraction

Configuration for creating a extraction is done by giving an `options` object (which has the [`IExtractorOptions`](https://github.com/lars-vc/LDES-Extractor/blob/root/src/ExtractorTransform.ts) interface ).

This object has the following parameters:

| parameter name       | default value                 | description                                                  |
| -------------------- | ----------------------------- | ------------------------------------------------------------ |
| `startdate`          |                               | A JavaScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object; the extraction will be created starting from this timestamp (always **required**)|
| `enddate`          |                               | A JavaScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object; the extraction will be created until this timestamp (always **required**)|
| `extractIdentifier`  | `http://example.org/extract`  | The identifier of the extraction                               |
| `ldesIdentifier`     |                               | The identifier of the LDES of which you want to create an extraction from (always **required**) |
| `versionOfPath`      |                               | The `ldes:versionOfPath` of the LDES (which is **required** in the Transform) |
| `timeStampPath`      |                               | The `ldes:timestampPath` of the LDES (which is **required** in the Transform) |

## Creating an extract using an N3 Store

Below is an example of how to use this package. As LDES, the example from [version materialization](https://semiceu.github.io/LinkedDataEventStreams/#version-materializations) in the LDES specification is used.

```javascript
const Extractor = require("@treecg/Extractor").Extractor //currently not on npm yet
const rdfParser = require("rdf-parse").default;
const storeStream = require("rdf-store-stream").storeStream;
const streamifyString = require('streamify-string');
    
const ldesString = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ldes: <https://w3id.org/ldes#> .
@prefix tree: <https://w3id.org/tree#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix owl: <https://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <http://example.org/> .

ex:ES1 a ldes:EventStream;
       ldes:versionOfPath dct:isVersionOf;
       ldes:timestampPath dct:created;
       tree:member [
           dct:isVersionOf <A> ;
           dct:created "2020-10-05T11:00:00Z"^^xsd:dateTime;
           owl:versionInfo "v0.0.1";
           rdfs:label "A v0.0.1"
       ], [
           dct:isVersionOf <A> ;
           dct:created "2020-10-06T13:00:00Z"^^xsd:dateTime;
           owl:versionInfo "v0.0.2";
           rdfs:label "A v0.0.2"
       ].`
// have the above ldes as a N3.Store using rdf-parse.js (https://github.com/rubensworks/rdf-parse.js)
const textStream = streamifyString(ldesString);
const quadStream = rdfParser.parse(textStream, {contentType: 'text/turtle'});
const store = await storeStream(quadStream);

// load the ldes store
const extractor = new Extractor(store);
// create the extract at a given time
const extraction = await extractor.create({
    startdate: new Date("2020-10-04T12:00:00Z"),
    enddate: new Date("2020-10-07T12:00:00Z"),
    ldesIdentifier: "http://example.org/ES1"
})
```

When converting the members to strings, the following output is achieved

```javascript
const Writer = require("n3").Writer
const writer = new Writer();
extraction.forEach(s => {
    console.log(writer.quadsToString(s.quads))
})
```

```turtle
_:n3-0 <http://purl.org/dc/terms/isVersionOf> <A> .
_:n3-0 <http://purl.org/dc/terms/created> "2020-10-05T11:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:n3-0 <https://www.w3.org/2002/07/owl#versionInfo> "v0.0.1" .
_:n3-0 <http://www.w3.org/2000/01/rdf-schema#label> "A v0.0.1" .

_:n3-1 <http://purl.org/dc/terms/isVersionOf> <A> .
_:n3-1 <http://purl.org/dc/terms/created> "2020-10-06T13:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:n3-1 <https://www.w3.org/2002/07/owl#versionInfo> "v0.0.2" .
_:n3-1 <http://www.w3.org/2000/01/rdf-schema#label> "A v0.0.2" .
```

You can also get the metadata with `Extractor.getMetadata()`

```javascript
const metadataStore = extractor.getMetadata()
console.log(metadataStore.getQuads())
```
```javascript
[
  Quad {
    id: '',
    _subject: NamedNode { id: 'http://example.org/extractor' },
    _predicate: NamedNode { id: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
    _object: NamedNode { id: 'https://w3id.org/ldes#EventStream' },
    _graph: DefaultGraph { id: '' }
  },
  Quad {
    id: '',
    _subject: NamedNode { id: 'http://example.org/extractor' },
    _predicate: NamedNode { id: 'https://w3id.org/ldes#versionOfPath' },
    _object: NamedNode { id: 'http://purl.org/dc/terms/isVersionOf' },
    _graph: DefaultGraph { id: '' }
  },
  Quad {
    id: '',
    _subject: NamedNode { id: 'http://example.org/extractor' },
    _predicate: NamedNode { id: 'https://w3id.org/ldes#timestampPath' },
    _object: NamedNode { id: 'http://purl.org/dc/terms/created' },
    _graph: DefaultGraph { id: '' }
  }
]
```

## Creating an extraction using streams

```javascript
const ExtractorTransform = require("@treecg/ExtractorTransform").ExtractorTransform;
const Readable = require("stream").Readable

// Note: uses the store defined in the first option of creating an extraction
const members = store.getObjects(null, 'https://w3id.org/tree#member', null)
const memberStream = new Readable({
    objectMode: true,
    read() {
        for (let member of members) {
            this.push({
                id: member,
                quads: store.getQuads(member, null, null, null)
            })
        }
        this.push(null)
    }
})

const extractionOptions = {
    startdate: new Date("2020-10-05T10:19:55Z"),
    enddate: new Date("2020-10-07T09:19:55Z"),
    ldesIdentifier: "http://example.org/ES1",
    versionOfPath: "http://purl.org/dc/terms/isVersionOf",
    timestampPath: "http://purl.org/dc/terms/created",
}
const extractorTransformer = new ExtractorTransform(extractionOptions)
const memberStreamTransformed = memberStream.pipe(extractorTransformer)

const Writer = require("n3").Writer
const writer = new Writer();

memberStreamTransformed.on('metadata', quads => {
    console.log('metadata')
    console.log(writer.quadsToString(quads))
})

memberStreamTransformed.on('data', ({id, quads}) => {
    console.log(`member: ${id.value}`)
    console.log(writer.quadsToString(quads))
})

memberStreamTransformed.on('end', () => {
    console.log('done')
})
```

Which will output the following

```bash
metadata
<http://example.org/ES1Extractor> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<http://example.org/ES1Extractor> <https://w3id.org/ldes#versionOfPath> <http://purl.org/dc/terms/isVersionOf> .
<http://example.org/ES1Extractor> <https://w3id.org/ldes#timestampPath> <http://purl.org/dc/terms/created> .

member: n3-0
_:n3-0 <http://purl.org/dc/terms/isVersionOf> <A> .
_:n3-0 <http://purl.org/dc/terms/created> "2020-10-05T11:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:n3-0 <https://www.w3.org/2002/07/owl#versionInfo> "v0.0.1" .
_:n3-0 <http://www.w3.org/2000/01/rdf-schema#label> "A v0.0.1" .

member: n3-1
_:n3-1 <http://purl.org/dc/terms/isVersionOf> <A> .
_:n3-1 <http://purl.org/dc/terms/created> "2020-10-06T13:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:n3-1 <https://www.w3.org/2002/07/owl#versionInfo> "v0.0.2" .
_:n3-1 <http://www.w3.org/2000/01/rdf-schema#label> "A v0.0.2" .

done
```
## Feedback and questions

Do not hesitate to [report a bug](https://github.com/lars-vc/LDES-Extractor/issues).

Further questions can also be asked to [Wout Slabbinck](mailto:wout.slabbinck@ugent.be) (developer and maintainer of the [Snapshot repository](https://github.com/TREEcg/LDES-Snapshot) of which this repository is based).
