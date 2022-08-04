/***************************************
 * Title: ExtractorTransform
 * Description: Transforms a Member stream to a stream of Members within two timestamps.
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 15/07/2022
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

/**
 * The
 */
export interface IExtractorOptions {
    /**
     * Start dateTime of the extraction
     */
    startDate?: Date;
    /**
     * End dateTime of the extraction
     */
    endDate?: Date;
    /**
     * The Version Identifier that all the members will have in the extraction.
     * When `undefined`, all Version Identifiers for the members are allowed.
     */
    versionIdentifier?: string;
    /**
     * The Identifier given for the extracted Collection
     */
    extractorIdentifier?: string;
    /**
     * The Identifier of the Versioned LDES where the extraction will be created from.
     */
    ldesIdentifier: string;
    /**
     * Corresponds to the object of the `ldes:versionOfPath` predicate of the Versioned LDES
     * This variable indicates property used to define the Version Identifier of a member.
     */
    versionOfPath?: string;
    /**
     * Corresponds to the object of the `ldes:timestampPath` predicate of the Versioned LDES.
     * This variable indicates property used to define the DateTime of a member.
     */
    timestampPath?: string;
}

export class ExtractorTransform extends Transform {
    private readonly logger = new Logger(this);

    private readonly startDate: Date;
    private readonly endDate: Date;
    private readonly versionIdentifier: string | undefined;
    private readonly extractorIdentifier: string;
    private readonly ldesIdentifier: string;
    private readonly versionOfPath: string;
    private readonly timestampPath: string;

    private emitedMetadata: boolean;
    private readonly _metadataStore: Store;

    public constructor(options: IExtractorOptions) {
        super({objectMode: true, highWaterMark: 1000});
        if (!options.versionOfPath) throw new Error("No versionOfPath was given in options")
        if (!options.timestampPath) throw new Error("No timestampPath was given in options")

        this.startDate = options.startDate ?? new Date(0); // possible issue with old dates (before 1 january 1970)
        this.endDate = options.endDate ?? new Date();
        this.extractorIdentifier = options.extractorIdentifier ?? `http://example.org/extract`;
        this.versionIdentifier = options.versionIdentifier;
        this.ldesIdentifier = options.ldesIdentifier;
        this.versionOfPath = options.versionOfPath;
        this.timestampPath = options.timestampPath;

        // create metadata for the extractor
        this._metadataStore = createExtractorMetadata({
            startDate: this.startDate,
            endDate: this.endDate,
            extractorIdentifier: this.extractorIdentifier,
            ldesIdentifier: this.ldesIdentifier,
            versionOfPath: this.versionOfPath,
            timestampPath: this.timestampPath,
        })
        this.emitedMetadata = false;
    }

    public _transform(chunk: any, _enc: any, done: () => void) {
        // called each member
        if (!this.emitedMetadata) {
            this.emit('metadata', this._metadataStore.getQuads(null, null, null, null))
            this.emitedMetadata = true
        }

        try {
            if (this.processMember(chunk)) {
                this.push(chunk)
            }
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

    private processMember(member: Member): boolean {
        const versionID = this.extractVersionId(member)
        const memberTime = this.extractDate(member)
        const withinBoundsCheck = this.startDate <= memberTime && memberTime <= this.endDate
        const versionIdentifierCheck = this.versionIdentifier ? this.versionIdentifier === versionID : true;

        return withinBoundsCheck && versionIdentifierCheck;
    }

    get metadataStore(): Store {
        return this._metadataStore;
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

    private extractVersionId(member: Member) {
        const store = new Store(member.quads)
        const versionIds = store.getObjects(member.id, namedNode(this.versionOfPath), null)
        if (versionIds.length !== 1) {
            throw Error(`Found ${versionIds.length} identifiers following the version paths of ${member.id.value}; expected one such identifier.`)
        }
        return versionIds[0].value
    }
}

