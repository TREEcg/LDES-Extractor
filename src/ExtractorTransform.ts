/***************************************
 * Title: ExtractorTransform
 * Description: Transforms a Member stream to a stream of materialized Members at a given extractor time.
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 07/03/2022
 *****************************************/
import {Transform} from 'stream';
import {Member} from '@treecg/types'
import {DataFactory, Literal, Store} from "n3";
import {Quad} from "@rdfjs/types";
import {extractDateFromLiteral} from "./util/TimestampUtil";
import {materialize} from "@treecg/version-materialize-rdf.js";
import {createExtractorMetadata, isMember} from "./util/ExtractorUtil";
import {Logger} from "./logging/Logger";
import namedNode = DataFactory.namedNode;
import quad = DataFactory.quad;

export interface IExtractorOptions {
    startdate: Date;
    enddate: Date;
    extractorIdentifier?: string;
    ldesIdentifier: string;
    versionOfPath?: string;
    timestampPath?: string;
    materialized?: boolean;
}

export class ExtractorTransform extends Transform {
    private readonly logger = new Logger(this);

    // transformedMap is a map that has as key the version identifier and as value the transformed quads of the member
    private transformedMap: Map<string, Array<Array<Quad>>>;
    // a map that has as key the version identifier and as a value the time of the current saved (in transformedMap)
    // transformed version of that version object

    private readonly startdate: Date;
    private readonly enddate: Date;
    private readonly extractorIdentifier: string;
    private readonly ldesIdentifier: string;
    private readonly versionOfPath: string;
    private readonly timestampPath: string;
    private readonly materialized: boolean;

    private emitedMetadata: boolean;
    private metadataStore: Store;

    public constructor(options: IExtractorOptions) {
        super({objectMode: true, highWaterMark: 1000});
        if (!options.versionOfPath) throw new Error("No versionOfPath was given in options")
        if (!options.timestampPath) throw new Error("No timestampPath was given in options")
        this.transformedMap = new Map<string, Array<Array<Quad>>>();

        this.startdate = options.startdate;
        this.enddate = options.enddate;
        this.extractorIdentifier = options.extractorIdentifier ? options.extractorIdentifier : `${options.ldesIdentifier}Extractor`;
        this.ldesIdentifier = options.ldesIdentifier;
        this.versionOfPath = options.versionOfPath;
        this.timestampPath = options.timestampPath;
        this.materialized = options.materialized ? options.materialized : false;

        // create metadata for the extractor
        this.metadataStore = createExtractorMetadata({
            startdate: this.startdate,
            enddate: this.enddate,
            extractorIdentifier: this.extractorIdentifier,
            ldesIdentifier: this.ldesIdentifier,
            versionOfPath: this.versionOfPath,
            timestampPath: this.timestampPath,
            materialized: this.materialized
        })
        this.emitedMetadata = false;

    }

    public _transform(chunk: any, _enc: any, done: () => void) {
        // called each member
        if (!this.emitedMetadata) {
            this.emit('metadata', this.metadataStore.getQuads(null, null, null, null))
            this.emitedMetadata = true
        }

        try {
            this.processMember(chunk)
        } catch (e) {
            if (isMember(chunk)) {
                this.logger.info(`Following member could not be transformed: ${chunk.id.value}`)
            } else {
                this.logger.info('item in stream was not a member: ' + chunk)
            }
            console.log(e)
        }
        done()
    }


    _flush() {
        // called at the end

        this.transformedMap.forEach((value, key) => {
            //Note: can be wrong if not all subjects of the quads are the same id
            // -> could be solved in a more thorough isMember test before processing the members
            for (let member of value) {
                this.push({id: member[0].subject, quads: member})
            }
        })
        this.push(null)
    }

    private processMember(member: Member) {
        const versionObjectID = this.extractVersionId(member)

        if (this.transformedMap.has(versionObjectID)) {
            const memberTime = this.extractDate(member)
            // dateTime must be between the given dates
            if (this.startdate <= memberTime && memberTime <= this.enddate) {
                this.transformedMap.get(versionObjectID)?.push(this.transform(member))
            }
        } else {
            //first time member
            const transformed = this.transform(member)
            const memberTime = this.extractDate(member)

            if (this.startdate <= memberTime && memberTime <= this.enddate) {
                this.transformedMap.set(versionObjectID, [transformed])
            }
        }
    }

    private transform(member: Member): Quad[] {
        const transformedTriples: Quad[] = []

        if (this.materialized) {
            const materializedQuads = materialize(member.quads, {
                versionOfProperty: namedNode(this.versionOfPath),
                timestampProperty: namedNode(this.timestampPath)
            });
            // code below here is to transform quads to triples
            for (const q of materializedQuads) {
                if (q.predicate.value === this.timestampPath) {
                    // have version object id as indication for the update
                    transformedTriples.push(quad(namedNode(this.extractVersionId(member)), q.predicate, q.object))
                } else {
                    // note: ugly fix to undefined problem, copying all other triples
                    if (q.subject) {
                        transformedTriples.push(quad(q.subject, q.predicate, q.object));
                    } else {
                        transformedTriples.push(quad(namedNode(q.graph.value), q.predicate, q.object));
                    }
                }
            }
        } else {
            transformedTriples.push(...member.quads)
        }
        return transformedTriples
    }

    // note: only handles xsd:dateTime
    private extractDate(member: Member): Date {
        const store = new Store(member.quads)
        const dateTimeLiterals = store.getObjects(member.id, namedNode(this.timestampPath), null)
        if (dateTimeLiterals.length !== 1) {
            throw Error(`Found ${dateTimeLiterals.length} dateTime literals following the timestamp path of ${member.id.value}; expected one such literal.`)
        }
        return extractDateFromLiteral(dateTimeLiterals[0] as Literal)
    }

    // note: use the raw member, not the materialized
    private extractVersionId(member: Member) {
        const store = new Store(member.quads)
        const versionIds = store.getObjects(member.id, namedNode(this.versionOfPath), null)
        if (versionIds.length !== 1) {
            throw Error(`Found ${versionIds.length} identifiers following the version paths of ${member.id.value}; expected one such identifier.`)
        }
        return versionIds[0].value
    }
}

