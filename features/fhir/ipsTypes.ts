export interface FhirCoding {
    system?: string;
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
}

export interface FhirCodeableConcept {
    coding?: FhirCoding[];
    text?: string;
}

export interface FhirIdentifier {
    use?: string;
    type?: FhirCodeableConcept;
    system?: string;
    value?: string;
}

export interface FhirReference {
    reference?: string;
    type?: string;
    identifier?: FhirIdentifier;
    display?: string;
}

export interface FhirQuantity {
    value?: number;
    comparator?: '<' | '<=' | '>=' | '>';
    unit?: string;
    system?: string;
    code?: string;
}

export interface FhirPeriod {
    start?: string;
    end?: string;
}

export interface FhirNarrative {
    status: 'generated' | 'extensions' | 'additional' | 'empty';
    div: string;
}

export interface FhirMeta {
    profile?: string[];
    security?: FhirCoding[];
    tag?: FhirCoding[];
    lastUpdated?: string;
}

export interface FhirR4Resource {
    resourceType: string;
    id?: string;
    meta?: FhirMeta;
    language?: string;
    text?: FhirNarrative;
    [key: string]: unknown;
}

export interface FhirCompositionSection {
    title?: string;
    code?: FhirCodeableConcept;
    author?: FhirReference[];
    focus?: FhirReference;
    text: FhirNarrative;
    mode?: 'working' | 'snapshot' | 'changes';
    orderedBy?: FhirCodeableConcept;
    entry?: FhirReference[];
    emptyReason?: FhirCodeableConcept;
    section?: FhirCompositionSection[];
}

export interface FhirComposition extends FhirR4Resource {
    resourceType: 'Composition';
    id: string;
    meta: FhirMeta;
    identifier: FhirIdentifier;
    status: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
    type: FhirCodeableConcept;
    subject: FhirReference;
    date: string;
    author: FhirReference[];
    title: string;
    confidentiality?: string;
    section: FhirCompositionSection[];
}

export interface FhirBundleEntry {
    fullUrl: string;
    resource: FhirR4Resource;
}

export interface FhirDocumentBundle extends FhirR4Resource {
    resourceType: 'Bundle';
    id: string;
    meta: FhirMeta;
    identifier: FhirIdentifier;
    type: 'document';
    timestamp: string;
    entry: FhirBundleEntry[];
}

export interface IpsValidationIssue {
    severity: 'error' | 'warning';
    code: string;
    path: string;
    message: string;
}

export interface IpsValidationResult {
    valid: boolean;
    errors: IpsValidationIssue[];
    warnings: IpsValidationIssue[];
    summary: {
        entries: number;
        sections: number;
        requiredSectionsPresent: number;
        unresolvedReferences: number;
    };
}

export interface IpsExportReport {
    generatedAt: string;
    fhirVersion: string;
    ipsVersion: string;
    packageId: string;
    includedCounts: Record<string, number>;
    excludedCounts: Record<string, number>;
    warnings: string[];
    validation: IpsValidationResult;
    limitations: string[];
}

export interface IpsExportResult {
    bundle: FhirDocumentBundle;
    report: IpsExportReport;
}
