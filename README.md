# Linked Data Event Stream extraction package

This package facilitates creating an **extraction** of a **versioned** Linked Data Event Stream ([LDES](https://semiceu.github.io/LinkedDataEventStreams/)) and is based on the [snapshot package](https://github.com/TREEcg/LDES-Snapshot).

## What is an extraction

An extraction of an LDES between **time `t1`** and **`t2`** for **Version Identifier `ID`** is a [collection](https://treecg.github.io/specification) of members with given `ID` where its timestamp $t \in [t1,t2]$.

It is also possible for an extraction to not have a **Version Identifier**. In this case, the extraction consists of the collection of all members with timestamp $t \in [t1,t2]$.-

## How to create an extraction


First, you have to install the package.

```bash
npm install @treecg/ldes-extractor
```

To create an extraction of an LDES, there are two options.

The first option is to create an extraction on a N3 Store.  This way of creating an extraction is straightforward. Load the LDES in a Store and then create the extraction. As simple as that! 
However, there is a downside: This approach will only work for an LDES  that can be completely be loaded into memory. Which means it only works for small LDESs.

The second option is to create an extraction streamingwise using a [Transform](https://nodejs.org/api/stream.html#class-streamtransform). 
As input a stream of [members](https://github.com/TREEcg/types/blob/main/lib/Member.ts) is required. This stream is then piped through the transformer which  will, when the stream stops, emit a stream of members. 
While working with streams might be a little more difficult, it allows  to create an extraction of a bigger LDESs as an LDES does not have to be loaded in memory.

### 🔧 Configuring the extractor

Configuration for creating a extraction is done by giving an `options` object (which has the [`IExtractorOptions`](https://github.com/TREEcg/LDES-Extractor/blob/root/src/ExtractorTransform.ts) interface ).

This object has the following parameters:

| parameter name       | default value                 | description                                                  |
| -------------------- | ----------------------------- | ------------------------------------------------------------ |
| `startdate`          | `new Date(0)` | A JavaScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object; the extraction will be created starting from this timestamp |
| `enddate`          | `new Date()` | A JavaScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object; the extraction will be created until this timestamp |
| `versionIdentifier` | `undefined`                  | *(Optional)* A `string`; the extraction will only contain members with this Version Identifier |
| `extractIdentifier`  | `http://example.org/extract`  | The identifier of the extraction Collection |
| `ldesIdentifier`     |                               | The identifier of the LDES of which you want to create an extraction from (always **required**) |
| `versionOfPath`      |                               | The `ldes:versionOfPath` of the LDES (which is **required** in the Transform) |
| `timeStampPath`      |                               | The `ldes:timestampPath` of the LDES (which is **required** in the Transform) |

## Creating an extraction using an N3 Store

Below is an example of how to use this package. As LDES, the example from [version materialization](https://semiceu.github.io/LinkedDataEventStreams/#version-materializations) in the LDES specification is used.

```javascript
const Extractor = require("@treecg/ldes-extractor").Extractor
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
console.log(writer.quadsToString(metadataStore.getQuads()))
```

```turtle
<http://example.org/extractor> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Collection> .
<http://example.org/extractor> <https://w3id.org/ldes#versionOfPath> <http://purl.org/dc/terms/isVersionOf> .
<http://example.org/extractor> <https://w3id.org/ldes#timestampPath> <http://purl.org/dc/terms/created> .
```

## Creating an extraction using streams

```javascript
const ExtractorTransform = require("@treecg/ldes-extractor").ExtractorTransform;
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
<http://example.org/ES1Extractor> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Collection> .
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

Do not hesitate to [report a bug](https://github.com/TREEcg/LDES-Extractor/issues).

Further questions can also be asked to [Wout Slabbinck](mailto:wout.slabbinck@ugent.be) (developer and maintainer of this repository).
