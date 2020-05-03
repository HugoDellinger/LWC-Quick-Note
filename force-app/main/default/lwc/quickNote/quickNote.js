import { LightningElement, wire, api, track } from "lwc";
import ID_FIELD from "@salesforce/schema/ContentNote.Id";
import Content_FIELD from "@salesforce/schema/ContentNote.Content";

import { getRecord } from "lightning/uiRecordApi";

import retrieveQuickContentDocumentIdForRecordId from "@salesforce/apex/QuickNoteController.retrieveQuickContentDocumentIdForRecordId";

export default class QuickNote extends LightningElement {
  @api recordId;
  @track quickContentDocumentVersionId;
  noteRecord;
  noteRecordContent; // To prevent decoding the content everytime we want to check equality with current content, we store the decoded string
  htmlContent;

  // Splitting the loading state for data fecthing in two steps
  // enables us to stop displaying the spinner if no existing note has been found
  // and thus no subsequent data loading happen
  initialLoading = true;
  dataLoading = false;
  get isLoading() {
    return this.initialLoading === true || this.dataLoading === true;
  }

  // We store the current content at each change to be able to show the correct state for the save button
  get isContentSameAsBefore() {
    return this.noteRecordContent == this.htmlContent; // eslint-disable-line eqeqeq
  }
  handleContentChange({ target }) {
    this.htmlContent = target.value;
  }

  handleErrors({ error }) {
    console.error(error);
  }

  @wire(retrieveQuickContentDocumentIdForRecordId, { recordId: "$recordId" })
  wiredContentDocumentId({ error, data }) {
    if (error) return this.handleErrors(); // TODO: error handling
    if (data !== undefined) {
      this.initialLoading = false;
      // TODO: set focus
      this.dataLoading = true;
      this.quickContentDocumentVersionId = data;
    }
    return null;
  }

  @wire(getRecord, {
    recordId: "$quickContentDocumentVersionId",
    fields: [ID_FIELD, Content_FIELD]
  })
  wiredContentDocument({ error, data }) {
    if (error) return this.handleErrors();
    this.noteRecord = data;
    if (this.noteRecord != null) {
      const encodedContent = this.noteRecord.fields.Content.value;
      this.htmlContent = window.atob(encodedContent);
      this.noteRecordContent = this.htmlContent;
    } else {
      this.htmlContent = null;
      this.noteRecordContent = null;
    }
    this.dataLoading = false;
    return null;
  }
}
