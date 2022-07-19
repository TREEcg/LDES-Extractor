import {DataFactory, Store} from "n3";
import {NamedNode} from "@rdfjs/types";
import {LDES, RDF} from "./Vocabularies";
import {IExtractorOptions} from "../ExtractorTransform";
import namedNode = DataFactory.namedNode;
import quad = DataFactory.quad;

/***************************************
 * Title: ExtractorUtil
 * Description: utility functions used in and for the ExtractorTransform
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 08/03/2022
 *****************************************/
/**
 * creates a store that corresponds to the metadata of a extractor
 * @param options extractor configuration
 * @return {Store}
 */
export function createExtractorMetadata(options: IExtractorOptions): Store {
    options.extractorIdentifier = options.extractorIdentifier ? options.extractorIdentifier : `${options.ldesIdentifier}Extractor`;

    const store = new Store()
    let extractorIdentifier: NamedNode = namedNode(options.extractorIdentifier)
    if (!options.versionOfPath) throw new Error("No versionOfPath was given in options")
    if (!options.timestampPath) throw new Error("No timestampPath was given in options")
    store.add(quad(extractorIdentifier, namedNode(RDF.type), namedNode(LDES.EventStream)))
    store.add(quad(extractorIdentifier, namedNode(LDES.versionOfPath), namedNode(options.versionOfPath)))
    store.add(quad(extractorIdentifier, namedNode(LDES.timestampPath), namedNode(options.timestampPath)))
    // todo: maybe add a reference to the original LDES? e.g. predicate: ldes:isExtractorOf
    //  on top of that: also add the time of the ldes. e.g. predicate: ldes:extractorAt
    return store
}

/**
 * Retrieves the versionOfPath of a version LDES
 * @param store
 * @param ldesIdentifier
 * @returns {string}
 */
export function retrieveVersionOfProperty(store: Store, ldesIdentifier: string): string {
    const versionOfProperties = store.getObjects(namedNode(ldesIdentifier), LDES.versionOfPath, null)
    if (versionOfProperties.length !== 1) {
        // https://semiceu.github.io/LinkedDataEventStreams/#version-materializations
        // A version materialization can be defined only if the original LDES defines both ldes:versionOfPath and ldes:timestampPath.
        throw Error(`Found ${versionOfProperties.length} versionOfProperties for ${ldesIdentifier}, only expected one`)
    }
    return versionOfProperties[0].id
}

/**
 * Retrieves the timestampPath of a version LDES
 * @param store
 * @param ldesIdentifier
 * @returns {string}
 */
export function retrieveTimestampProperty(store: Store, ldesIdentifier: string): string {
    const timestampProperties = store.getObjects(namedNode(ldesIdentifier), LDES.timestampPath, null)
    if (timestampProperties.length !== 1) {
        // https://semiceu.github.io/LinkedDataEventStreams/#version-materializations
        // A version materialization can be defined only if the original LDES defines both ldes:versionOfPath and ldes:timestampPath.
        throw Error(`Found ${timestampProperties.length} timestampProperties for ${ldesIdentifier}, only expected one`)
    }
    return timestampProperties[0].id
}


export function extractExtractorOptions(store: Store, ldesIdentifier: string): IExtractorOptions {
    return {
        ldesIdentifier: ldesIdentifier,
        timestampPath: retrieveTimestampProperty(store, ldesIdentifier),
        versionOfPath: retrieveVersionOfProperty(store, ldesIdentifier),
        startDate: new Date(),
        endDate: new Date()
    }
}

export function isMember(data: any): boolean {
    if (typeof data !== 'object' &&
        !Array.isArray(data) &&
        data !== null) {
        return false
    }
    if (!(data.id && typeof data.id.value === 'string')) {
        return false
    }

    if (data.quads && Array.isArray(data.quads)) {
        if (data.quads.length > 0 && data.quads[0].termType === 'Quad') {
            return true
        } else return false
    } else return false
}
