import {memberStreamtoStore, storeAsMemberStream, storeToString, turtleStringToStore} from "../src/util/Conversion";
import {Readable} from "stream";
import {IExtractorOptions, ExtractorTransform} from "../src/ExtractorTransform";
import {extractExtractorOptions} from "../src/util/ExtractorUtil";
import {DCT, LDES, RDF, TREE} from "../src/util/Vocabularies";
import {DataFactory, Literal, Store} from "n3";
import {dateToLiteral, extractDateFromLiteral} from "../src/util/TimestampUtil";
import quad = DataFactory.quad;
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;


describe("A ExtractorTransform", () => {
    const ldesIdentifier = 'http://example.org/ES'
    const extractorIdentifier = 'http://example.org/extractor'
    const startDate = new Date()
    const endDate = new Date()

    let store: Store
    let memberStream: Readable
    let extractorOptions: IExtractorOptions
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
        extractorOptions = extractExtractorOptions(store, ldesIdentifier)
        extractorOptions.startDate = startDate
        extractorOptions.endDate = endDate
        extractorOptions.extractorIdentifier = extractorIdentifier
    })
    beforeEach(() => {
        memberStream = storeAsMemberStream(store)
    })

    describe("constructor", () => {
        it("errors when no version path is given.", () => {
            const customExtractorOptions: IExtractorOptions = {
                ldesIdentifier: extractorOptions.ldesIdentifier,
                timestampPath: extractorOptions.timestampPath,
                startDate: extractorOptions.startDate,
                endDate: extractorOptions.startDate
            }
            expect(() => new ExtractorTransform(customExtractorOptions)).toThrow(Error)
        })

        it("errors when no timestamp path is given.", () => {
            const customExtractorOptions: IExtractorOptions = {
                ldesIdentifier: extractorOptions.ldesIdentifier,
                versionOfPath: extractorOptions.versionOfPath,
                startDate: extractorOptions.startDate,
                endDate: extractorOptions.startDate
            }
            expect(() => new ExtractorTransform(customExtractorOptions)).toThrow(Error)
        })
    })
    it("generates a quad stream for metadata", async () => {
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = memberStream.pipe(extractorTransformer)

        const test = new Promise((resolve, reject) => {
            memberStreamTransformed.on('end', resolve).on('error', reject)
            memberStreamTransformed.on('metadata', quads => {
                try {
                    expect(quads).toBeInstanceOf(Array)
                    const metadataStore = new Store(quads)
                    expect(metadataStore.getQuads(extractorIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
                    expect(metadataStore.getQuads(extractorIdentifier, LDES.versionOfPath, extractorOptions.versionOfPath!, null).length).toBe(1)
                    expect(metadataStore.getQuads(extractorIdentifier, LDES.timestampPath, extractorOptions.timestampPath!, null).length).toBe(1)
                } catch (e) {
                    reject(e)
                }
            })
            memberStreamTransformed.on('data', () => {
            })

        })
        await test
    })

    it("generates a data stream of members", async () => {
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = memberStream.pipe(extractorTransformer)
        const test = new Promise((resolve, reject) => {
            memberStreamTransformed.on('end', resolve).on('error', reject)
            memberStreamTransformed.on('data', member => {
                try {
                    expect(member.quads).toBeInstanceOf(Array)

                    expect(member.id.value).toBe('http://example.org/resource1v1')
                    const memberStore = new Store(member.quads)

                    expect(memberStore.getQuads(member.id.value, DCT.isVersionOf, 'http://example.org/resource1', null).length).toBe(1)
                    expect(memberStore.getQuads(member.id.value, DCT.issued, null, null).length).toBe(1)
                    expect(memberStore.getQuads(member.id.value, DCT.title, null, null).length).toBe(1)

                    expect(memberStore.getObjects(member.id.value, DCT.title, null)[0].value).toStrictEqual('Title has been updated once')
                    const dateLiteral = memberStore.getObjects(member.id.value, DCT.issued, null)[0] as Literal
                    expect(extractDateFromLiteral(dateLiteral)).toStrictEqual(new Date("2021-12-15T12:00:00.000Z"))
                } catch (e) {
                    reject(e)
                }
            })

        })
        await test
    })

    it("ignores data in the stream that are not members.", async () => {
        memberStream.push("not a member")
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = memberStream.pipe(extractorTransformer)
        // read whole output of the transformed member stream
        await memberStreamtoStore(memberStreamTransformed, extractorIdentifier)
    })

    it("ignores members that have no version ID.", async () => {
        const versionSpecificID = "http://example.org/resource2v0"
        const resourceIdentifier = 'http://example.org/resource2'
        const dateLiteral = dateToLiteral(new Date("2020-10-05T11:00:00Z"))
        memberStream.push({
            id: namedNode(versionSpecificID), quads: [
                quad(namedNode(versionSpecificID), namedNode(DCT.created), dateLiteral),
                quad(namedNode(versionSpecificID), namedNode(DCT.title), literal("some Title.")),
            ]
        })
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = memberStream.pipe(extractorTransformer)
        // read whole output of the transformed member stream
        const transformedStore = await memberStreamtoStore(memberStreamTransformed, extractorIdentifier)

        expect(transformedStore.getQuads(resourceIdentifier, null, null, null).length).toBe(0)
    })

    it("ignores members that have no timestamp.", async () => {
        const versionSpecificID = "http://example.org/resource2v0"
        const resourceIdentifier = 'http://example.org/resource2'
        memberStream.push({
            id: namedNode(versionSpecificID), quads: [
                quad(namedNode(versionSpecificID), namedNode(DCT.isVersionOf), namedNode(resourceIdentifier)),
                quad(namedNode(versionSpecificID), namedNode(DCT.title), literal("some Title.")),
            ]
        })
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = memberStream.pipe(extractorTransformer)
        // read whole output of the transformed member stream
        const transformedStore = await memberStreamtoStore(memberStreamTransformed, extractorIdentifier)

        expect(transformedStore.getQuads(resourceIdentifier, null, null, null).length).toBe(0)
    })

    it("generated using default values for date and extractorIdentifier", async () => {
        const extractorTransformer = new ExtractorTransform({
            ldesIdentifier: extractorOptions.ldesIdentifier,
            timestampPath: extractorOptions.timestampPath,
            versionOfPath: extractorOptions.versionOfPath,
            startDate: extractorOptions.startDate,
            endDate: extractorOptions.startDate
        })
        const memberStreamTransformed = memberStream.pipe(extractorTransformer)
        const extractorIdentifier = 'http://example.org/extractor'
        const transformedStore = await memberStreamtoStore(memberStreamTransformed, extractorIdentifier)

        expect(transformedStore.getQuads('http://example.org/resource1v1', null, null, null).length).toBe(0)
    })

    it("handles memberStream with triples in quads that have different subject than member itself", async () => {
        // todo: document more understandable and do actual test
        const stream = new Readable({
            objectMode: true,
            read() {
                const identifierNode = namedNode("http://example.org/ex#v1")
                const versionNode = namedNode("http://example.org/ex")
                store = new Store();
                store.addQuad(identifierNode, namedNode(DCT.title), literal("test"))
                store.addQuad(identifierNode, namedNode(DCT.isVersionOf), versionNode)
                store.addQuad(identifierNode, namedNode(DCT.issued), dateToLiteral(new Date("2021-12-15T10:00:00.000Z")))
                store.addQuad(identifierNode, namedNode('http://extra/'), namedNode("http://example.org/"))
                store.addQuad(namedNode("http://example.org/"), namedNode(DCT.title), literal("test"))
                this.push({
                    id: identifierNode,
                    quads: store.getQuads(null, null, null, null)
                })
                this.push(null)
            }
        })
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = stream.pipe(extractorTransformer)
        const transformedStore = await memberStreamtoStore(memberStreamTransformed)
        console.log(storeToString(transformedStore))
        console.log(transformedStore.countQuads(null, null, null, null))
    })

    it("handles memberStream with triples in quads that have blank node subject linked by member", async () => {
        // todo: document more understandable and do actual test
        const stream = new Readable({
            objectMode: true,
            read() {
                const identifierNode = namedNode("http://example.org/ex#v1")
                const versionNode = namedNode("http://example.org/ex")
                store = new Store();
                store.addQuad(identifierNode, namedNode(DCT.title), literal("test"))
                store.addQuad(identifierNode, namedNode(DCT.isVersionOf), versionNode)
                store.addQuad(identifierNode, namedNode(DCT.issued), dateToLiteral(new Date("2021-12-15T10:00:00.000Z")))
                const bn = store.createBlankNode()
                store.addQuad(identifierNode, namedNode('http://extra/'), bn)
                store.addQuad(bn, namedNode(DCT.title), literal("test"))
                this.push({
                    id: identifierNode,
                    quads: store.getQuads(null, null, null, null)
                })
                this.push(null)
            }
        })
        const extractorTransformer = new ExtractorTransform(extractorOptions)
        const memberStreamTransformed = stream.pipe(extractorTransformer)
        const transformedStore = await memberStreamtoStore(memberStreamTransformed)
        console.log(storeToString(transformedStore))
        console.log(transformedStore.countQuads(null, null, null, null))
    })
})
