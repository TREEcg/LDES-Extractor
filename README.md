# Linked Data Event Stream snapshots package

This package facilitates creating a(n) **timeframe/extract** of a **versioned** Linked Data Event Stream ([LDES](https://semiceu.github.io/LinkedDataEventStreams/)) and is based on the [snapshot package](https://github.com/TREEcg/LDES-Snapshot)

### 🔧 Configuring the extraction

Configuration for creating a extraction is done by giving an `options` object (which has the [`IExtractOptions`](https://github.com/lars-vc/LDES-Extractor/blob/root/src/ExtractorTransform.ts) interface ).

This object has the following parameters:

| parameter name       | default value                 | description                                                  |
| -------------------- | ----------------------------- | ------------------------------------------------------------ |
| `startdate`          |                               | A JavaScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object; the snapshot will be created until this timestamp |
| `extractIdentifier`  | `http://example.org/extract`  | The identifier of the snapshot                               |
| `ldesIdentifier`     |                               | The identifier of the LDES of which you want to create a snapshot from (always **required**) |
| `versionOfPath`      |                               | The `ldes:versionOfPath` of the LDES (which is **required** in the Transform) |
| `timeStampPath`      |                               | The `ldes:timestampPath` of the LDES (which is **required** in the Transform) |

## Feedback and questions

Do not hesitate to [report a bug](https://github.com/TREEcg/LDES-Snapshot/issues).

Further questions can also be asked to [Wout Slabbinck](mailto:wout.slabbinck@ugent.be) (developer and maintainer of the [Snapshot repository](https://github.com/TREEcg/LDES-Snapshot)).
