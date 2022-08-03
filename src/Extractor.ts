import {Store} from "n3";
import {retrieveTimestampProperty, createExtractorMetadata, retrieveVersionOfProperty} from "./util/ExtractorUtil";
import {IExtractorOptions, ExtractorTransform} from "./ExtractorTransform";
import {memberStreamtoList, memberStreamtoStore, storeAsMemberStream} from "./util/Conversion";
import {Member} from '@treecg/types'

/***************************************
 * Title: Extractor
 * Description: Class to create an extraction of an LDES within two timestamps (only works for small LDESes)
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 03/03/2022
 *****************************************/
export class Extractor {
    private readonly baseStore: Store;
    private metadataStore?: Store;

    constructor(store: Store) {
        this.baseStore = store;
        this.metadataStore = undefined;
    }

    /**
     * Creates a extractor from a versioned LDES. (see: https://semiceu.github.io/LinkedDataEventStreams/#version-materializations)
     * Default:
     * uses "http://example.org/extractor" as identifier for the extractor (tree:collection)
     * and uses the current time for ldes:versionMaterializationUntil
     * @param options optional extra paramaters for creating the extractor
     * @return {Promise<Member[]>}
     */
    public async create(options: IExtractorOptions): Promise<Member[]> {
        options.extractorIdentifier = options.extractorIdentifier ?? 'http://example.org/extractor';
        options.timestampPath = options.timestampPath ?? retrieveTimestampProperty(this.baseStore, options.ldesIdentifier)
        options.versionOfPath = options.versionOfPath ?? retrieveVersionOfProperty(this.baseStore, options.ldesIdentifier)

        const memberStream = storeAsMemberStream(this.baseStore)
        const extractorTransformer = new ExtractorTransform(options);
        const transformationOutput = memberStream.pipe(extractorTransformer)
        const memberlist = await memberStreamtoList(transformationOutput)
        this.metadataStore = extractorTransformer.metadataStore;
        return memberlist
    }

    // get metadata based of created memberlist
    public getMetadata(): Store {
        if (this.metadataStore === undefined) {
            throw new Error("Can't get metadata before running create");
        }
        return this.metadataStore
    }
// TODO: remove -> can be done with the util
    // create new metadata based on IExtractorOptions
    public createNewMetadata(options: IExtractorOptions): Store {
        return createExtractorMetadata(options)
    }
}

