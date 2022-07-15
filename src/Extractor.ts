import {Store} from "n3";
import {retrieveTimestampProperty, retrieveVersionOfProperty} from "./util/ExtractorUtil";
import {IExtractorOptions, ExtractorTransform} from "./ExtractorTransform";
import {memberStreamtoList, storeAsMemberStream} from "./util/Conversion";
import {Member} from '@treecg/types'

/***************************************
 * Title: Extractor
 * Description: Class to create a materialized LDES at a certain timestamp (only works for small LDESes)
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 03/03/2022
 *****************************************/
export class Extractor {
    private baseStore: Store;

    constructor(store: Store) {
        this.baseStore = store;
    }

    /**
     * Creates a extractor from a version LDES. (see: https://semiceu.github.io/LinkedDataEventStreams/#version-materializations)
     * Default:
     * uses "http://example.org/extractor" as identifier for the extractor (tree:collection)
     * and uses the current time for ldes:versionMaterializationUntil
     * @param options optional extra paramaters for creating the extractor
     * @return {Promise<Member[]>}
     */
    async create(options: IExtractorOptions): Promise<Member[]> {
        options.extractorIdentifier = options.extractorIdentifier ? options.extractorIdentifier : 'http://example.org/extractor';
        options.timestampPath = options.timestampPath ? options.timestampPath : retrieveTimestampProperty(this.baseStore, options.ldesIdentifier)
        options.versionOfPath = options.versionOfPath ? options.versionOfPath : retrieveVersionOfProperty(this.baseStore, options.ldesIdentifier)

        const memberStream = storeAsMemberStream(this.baseStore)
        const extractorTransformer = new ExtractorTransform(options);
        const transformationOutput = memberStream.pipe(extractorTransformer)
        const memberlist = await memberStreamtoList(transformationOutput)

        return memberlist
    }

}

