import {turtleStringToStore} from "../../src/util/Conversion";
import {
    createExtractorMetadata,
    extractExtractorOptions,
    isMember,
    retrieveTimestampProperty,
    retrieveVersionOfProperty
} from "../../src/util/ExtractorUtil";
import {DCT, LDES, RDF} from "../../src/util/Vocabularies";
import {DataFactory, Store} from "n3";
import namedNode = DataFactory.namedNode;
import quad = DataFactory.quad;
import literal = DataFactory.literal;
import {IExtractorOptions} from "../../src/ExtractorTransform";

describe("A ExtractorUtil", () => {
    const ldesIdentifier = 'http://example.org/ES'
    let store: Store
    beforeAll(async () => {
        const ldes = `
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
        store = await turtleStringToStore(ldes)
    })
    describe("for retrieving the ldes:versionOfPath", () => {
        it("errors when there is no versionOfPath predicate found in the store", async () => {
            const ldesString = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ldes: <https://w3id.org/ldes#> .
@prefix tree: <https://w3id.org/tree#> .
@prefix ex: <http://example.org/> .

ex:ES a ldes:EventStream;
    ldes:timestampPath dct:issued.`
            const store = await turtleStringToStore(ldesString)
            expect(() => retrieveVersionOfProperty(store, ldesIdentifier)).toThrow(Error)
        })

        it("errors when there is no versionOfPath predicate found in the store for the given identifier", async () => {
            expect(() => retrieveVersionOfProperty(store, 'http://example.org/identifier')).toThrow(Error)
        })

        it("retrieves the correct versionOfPath", async () => {
            expect(retrieveVersionOfProperty(store, ldesIdentifier)).toBe(DCT.isVersionOf)
        })
    })
    describe("for retrieving the ldes:timestampPath", () => {
        it("errors when there is no timestampPath predicate found in the store", async () => {
            const ldesString = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ldes: <https://w3id.org/ldes#> .
@prefix tree: <https://w3id.org/tree#> .
@prefix ex: <http://example.org/> .

ex:ES a ldes:EventStream;
    ldes:versionOfPath dct:isVersionOf.`
            const store = await turtleStringToStore(ldesString)
            expect(() => retrieveTimestampProperty(store, ldesIdentifier)).toThrow(Error)
        })

        it("errors when there is no timestampPath predicate found in the store for the given identifier", async () => {
            expect(() => retrieveTimestampProperty(store, 'http://example.org/identifier')).toThrow(Error)
        })

        it("retrieves the correct timestampPath", async () => {
            expect(retrieveTimestampProperty(store, ldesIdentifier)).toBe(DCT.issued)
        })
    })
    describe("for extracting Extractor Options", () => {
        it("returns a IExtractorOptions object", () => {
            const extractorOptions = extractExtractorOptions(store, ldesIdentifier)
            expect(extractorOptions.ldesIdentifier).toBe(ldesIdentifier)
            expect(extractorOptions.timestampPath).toBe(DCT.issued)
            expect(extractorOptions.versionOfPath).toBe(DCT.isVersionOf)
            expect(extractorOptions.startDate).toBeDefined()
            expect(extractorOptions.endDate).toBeDefined()
            expect(extractorOptions.extractorIdentifier).toBe(undefined)
        })

    })
    describe("for creating the metadata of a Extractor", () => {
        it("errors when no version path is given.", () => {
            const extractorOptions = extractExtractorOptions(store, ldesIdentifier)

            const customExtractorOptions: IExtractorOptions = {
                ldesIdentifier: extractorOptions.ldesIdentifier,
                timestampPath: extractorOptions.timestampPath,
                startDate: new Date(),
                endDate: new Date()
            }
            expect(() => createExtractorMetadata(customExtractorOptions)).toThrow(Error)
        })

        it("errors when no timestamp path is given.", () => {
            const extractorOptions = extractExtractorOptions(store, ldesIdentifier)

            const customExtractorOptions: IExtractorOptions = {
                ldesIdentifier: extractorOptions.ldesIdentifier,
                versionOfPath: extractorOptions.versionOfPath,
                startDate: new Date(),
                endDate: new Date()
            }
            expect(() => createExtractorMetadata(customExtractorOptions)).toThrow(Error)
        })

        it("creates a store that contains the metadata triples of a extractor with default settings", () => {
            const extractorOptions = extractExtractorOptions(store, ldesIdentifier)

            const extractorMetadataStore = createExtractorMetadata(extractorOptions)
            const extractorIdentifier = `${ldesIdentifier}Extractor`

            expect(extractorMetadataStore.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
            expect(extractorMetadataStore.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)
            expect(extractorMetadataStore.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
        })
    })

    describe("for testing whether some data is a member", () => {
        let member: any
        beforeEach(() => {
            member = {
                id: namedNode("http://example.org/resource1"),
                quads: [
                    quad(namedNode("http://example.org/resource1"), namedNode(DCT.title), literal("some title"))
                ]
            }
        })
        it("returns true for a member conforming to the Member interface.", () => {
            expect(isMember(member)).toBeTruthy()
        })
        it("returns false for a string.", () => {
            expect(isMember("data")).toBeFalsy()
        })
        it("returns false when there is no id.", () => {
            member.id = null
            expect(isMember(member)).toBeFalsy()
        })
        it("returns false when the id is a string instead of a Term.", () => {
            member.id = 'something'
            expect(isMember(member)).toBeFalsy()
        })

        it("returns false when there are no quads.", () => {
            member.quads = null
            expect(isMember(member)).toBeFalsy()
        })
        it("returns false when quads is an array of strings.", () => {
            member.quads = ["Something"]
            expect(isMember(member)).toBeFalsy()
        })
        it("returns false when quads is an empty array of strings.", () => {
            member.quads = []
            expect(isMember(member)).toBeFalsy()
        })

    })
})
