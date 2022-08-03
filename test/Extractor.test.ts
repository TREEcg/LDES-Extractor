import {turtleStringToStore} from "../src/util/Conversion";
import {Extractor} from "../src/Extractor";
import {Literal, NamedNode, Quad, Store} from "n3";
import {IExtractorOptions} from "../src/ExtractorTransform";
import {DCT, LDES, RDF} from "../src/util/Vocabularies";

describe("An Extract", () => {
    const ldesExample = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ldes: <https://w3id.org/ldes#> .
@prefix tree: <https://w3id.org/tree#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:ES a ldes:EventStream;
    ldes:versionOfPath dct:isVersionOf;
    ldes:timestampPath dct:issued;
    tree:member ex:resource1v0, ex:resource1v1.

ex:resource1v0
    dct:isVersionOf ex:resource1;
    dct:issued "2021-12-15T10:00:00.000Z"^^xsd:dateTime;
    dct:title "First version of the title".

ex:resource1v1
    dct:isVersionOf ex:resource1;
    dct:issued "2021-12-15T12:00:00.000Z"^^xsd:dateTime;
    dct:title "Title has been updated once".
`
    let extractorExample: Extractor
    let extractorOptions: IExtractorOptions
    let store: Store

    beforeAll(async () => {
        store = await turtleStringToStore(ldesExample)
        extractorExample = new Extractor(store)
    })
    beforeEach(async () => {
        extractorOptions = {
            startDate: new Date(),
            endDate: new Date(),
            ldesIdentifier: "http://example.org/ES",
            extractorIdentifier: "http://example.org/extractor",
            timestampPath: DCT.issued,
            versionOfPath: DCT.isVersionOf
        }
    })

    it('an extractor as defined by the spec on an LDES with blank node members', async () => {
        const ldes = `
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix ldes: <https://w3id.org/ldes#> .
    @prefix tree: <https://w3id.org/tree#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix ex: <http://example.org/> .
    @prefix owl: <https://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

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
        const store = await turtleStringToStore(ldes)
        const extractor = new Extractor(store)
        extractorOptions.ldesIdentifier = "http://example.org/ES1"
        extractorOptions.timestampPath = "http://purl.org/dc/terms/created"
        extractorOptions.startDate = new Date("2020-10-06T14:00:00Z")
        const extractorMemberlist = await extractor.create(extractorOptions)

        const extractorMetadata = extractor.getMetadata()
        const extractorIdentifier = extractorOptions.extractorIdentifier!

        expect(extractorMemberlist.length).toBe(0)
        expect(extractorMetadata.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
        expect(extractorMetadata.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
        expect(extractorMetadata.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)
    })
    it('an extractor with correct members based on date', async () => {
        // interval before the first member
        const startDateBefore = new Date('2021-12-15T09:00:00.000Z')
        const endDateBefore = new Date('2021-12-15T09:30:00.000Z')
        extractorOptions.startDate = startDateBefore
        extractorOptions.endDate = endDateBefore
        const extractorMemberlistBefore = await extractorExample.create(extractorOptions)
        const extractorMetadataStoreBefore = extractorExample.getMetadata()

        const extractorIdentifier = extractorOptions.extractorIdentifier!

        expect(extractorMetadataStoreBefore.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
        expect(extractorMetadataStoreBefore.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
        expect(extractorMetadataStoreBefore.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)

        expect(extractorMemberlistBefore.length).toBe(0)

        // interval surrounding first member added to LDES
        const startDateSurroundFirst = new Date('2021-12-15T09:00:00.000Z')
        const endDateSurroundFirst = new Date('2021-12-15T10:30:00.000Z')
        extractorOptions.startDate = startDateSurroundFirst
        extractorOptions.endDate = endDateSurroundFirst


        const extractorMemberlistSurroundFirst = await extractorExample.create(extractorOptions)

        const extractorStoreMetadataSurroundFirst = extractorExample.getMetadata()

        expect(extractorStoreMetadataSurroundFirst.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
        expect(extractorStoreMetadataSurroundFirst.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
        expect(extractorStoreMetadataSurroundFirst.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)

        expect(extractorMemberlistSurroundFirst.length).toBe(1)

        expect(extractorMemberlistSurroundFirst[0].quads[2]).toStrictEqual(new Quad(new NamedNode('http://example.org/resource1v0'), new NamedNode('http://purl.org/dc/terms/title'), new Literal('"First version of the title"'), undefined))

        // interval surrounding both members
        const startDateSurroundBoth = new Date('2021-12-15T09:00:00.000Z')
        const endDateSurroundBoth = new Date('2021-12-15T12:00:00.000Z')
        extractorOptions.startDate = startDateSurroundBoth
        extractorOptions.endDate = endDateSurroundBoth

        const extractorMemberlistSurroundBoth = await extractorExample.create(extractorOptions)
        const extractorStoreMetadataSurroundBoth = extractorExample.getMetadata()

        expect(extractorStoreMetadataSurroundBoth.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
        expect(extractorStoreMetadataSurroundBoth.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
        expect(extractorStoreMetadataSurroundBoth.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)

        expect(extractorMemberlistSurroundBoth.length).toBe(2)

        expect(extractorMemberlistSurroundBoth[0].quads[2]).toStrictEqual(new Quad(new NamedNode('http://example.org/resource1v0'), new NamedNode('http://purl.org/dc/terms/title'), new Literal('"First version of the title"'), undefined))
        expect(extractorMemberlistSurroundBoth[1].quads[2]).toStrictEqual(new Quad(new NamedNode('http://example.org/resource1v1'), new NamedNode('http://purl.org/dc/terms/title'), new Literal('"Title has been updated once"'), undefined))
    })

    it('is generated as defined by the spec on an LDES', async () => {
        await extractorExample.create(extractorOptions)
        const extractorStore = extractorExample.getMetadata()
        const extractorIdentifier = extractorOptions.extractorIdentifier!

        expect(extractorStore.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
        expect(extractorStore.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
        expect(extractorStore.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)
    })
})
