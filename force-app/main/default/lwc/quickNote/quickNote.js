import { LightningElement, wire, api, track } from "lwc";
import ID_FIELD from "@salesforce/schema/ContentNote.Id";
import Content_FIELD from "@salesforce/schema/ContentNote.Content";

import { getRecord } from "lightning/uiRecordApi";

import retrieveQuickContentDocumentIdForRecordId from "@salesforce/apex/QuickNoteController.retrieveQuickContentDocumentIdForRecordId";

export default class QuickNote extends LightningElement {
  @api recordId;
  @track quickContentDocumentVersionId;

  @wire(retrieveQuickContentDocumentIdForRecordId, { recordId: "$recordId" })
  wiredContentDocumentId({ error, data }) {
    if (error) console.error(error); // TODO: error handling
    if (data) this.quickContentDocumentVersionId = data;
  }

  @wire(getRecord, {
    recordId: "$quickContentDocumentVersionId",
    fields: [ID_FIELD, Content_FIELD]
  })
  wiredContentDocument(result) {
    console.log(result);
  }
}
