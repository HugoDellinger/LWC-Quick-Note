import { LightningElement, wire, api, track } from "lwc";
import { updateRecord, createRecord, getRecord } from "lightning/uiRecordApi";
import { refreshApex } from "@salesforce/apex";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

import CN_ID_FIELD from "@salesforce/schema/ContentNote.Id";
import CN_CONTENT_FIELD from "@salesforce/schema/ContentNote.Content";
import CN_TITLE_FIELD from "@salesforce/schema/ContentNote.Title";
import CN_OBJECT from "@salesforce/schema/ContentNote";

import retrieveQuickContentDocumentIdForRecordId from "@salesforce/apex/QuickNoteController.retrieveQuickContentDocumentIdForRecordId";
import createNoteLink from "@salesforce/apex/QuickNoteController.createNoteLink";

export default class QuickNote extends LightningElement {
  @api recordId;
  @track quickContentDocumentVersionId;
  noteRecord;

  // Splitting the loading state for data fecthing in two steps
  // enables us to stop displaying the spinner if no existing note has been found
  // and thus no subsequent data loading happen
  initialLoading = true;
  dataLoading = false;
  isSaving = false;
  get isLoading() {
    return (
      this.initialLoading === true ||
      this.dataLoading === true ||
      this.isSaving === true
    );
  }

  renderedCallback() {
    document.addEventListener("keydown", this.handleKeyboardSave.bind(this));
  }

  // # Save status management
  // We store the current content at each change to be able to show the correct state for the save button
  noteRecordContent; // To prevent decoding the content everytime we want to check equality with current content, we store the decoded string
  htmlContent;
  get isContentSameAsBefore() {
    return this.noteRecordContent == this.htmlContent; // eslint-disable-line eqeqeq
  }
  handleContentChange({ target }) {
    this.htmlContent = target.value;
  }
  get isSaveDisabled() {
    return this.isContentSameAsBefore === true || this.isSaving === true;
  }

  async insertNote() {
    const fields = {
      [CN_CONTENT_FIELD.fieldApiName]: window.btoa(this.htmlContent),
      [CN_TITLE_FIELD.fieldApiName]: "QuickNote"
    };
    const noteRecord = await createRecord({
      apiName: CN_OBJECT.objectApiName,
      fields
    });
    this.noteRecord = noteRecord;
    await createNoteLink({ noteId: noteRecord.id, recordId: this.recordId });
  }

  async updateNote() {
    const fields = {
      [CN_ID_FIELD.fieldApiName]: this.noteRecord.id,
      [CN_CONTENT_FIELD.fieldApiName]: window.btoa(this.htmlContent),
      [CN_TITLE_FIELD.fieldApiName]: "QuickNote"
    };
    await updateRecord({ fields });
  }

  // # Save data
  async handleSave() {
    try {
      if (this.isContentSameAsBefore || this.isSaving) return; // don't save if the content is the same as before
      this.isSaving = true;
      if (this.noteRecord == null) {
        await this.insertNote();
        refreshApex(this.quickContentDocumentVersionId);
      } else {
        await this.updateNote();
        refreshApex(this.noteRecord);
      }
      const event = new ShowToastEvent({
        title: "Quick Note saved",
        variant: "success"
      });
      this.dispatchEvent(event);
    } catch (error) {
      this.handleErrors({ error });
    } finally {
      this.isSaving = false;
    }
  }
  hasFocus = false;
  async handleKeyboardSave(event) {
    if (
      (event.ctrlKey === true || event.metaKey === true) &&
      event.keyCode === 83 && // S keyCode
      this.hasFocus === true
    ) {
      event.preventDefault();
      await this.handleSave();
    }
  }
  handleFocus() {
    this.hasFocus = true;
  }
  handleBlur() {
    this.hasFocus = false;
  }

  handleErrors({ error }) {
    console.error(error); // eslint-disable-line no-console
    const errorMessage = error.body || error.message || error;
    const event = new ShowToastEvent({
      title: "An error occured while saving your quick note",
      message: errorMessage,
      variant: "error"
    });
    this.dispatchEvent(event);
  }

  @wire(retrieveQuickContentDocumentIdForRecordId, { recordId: "$recordId" })
  wiredContentDocumentId({ error, data }) {
    if (error) return this.handleErrors(); // TODO: error handling

    if (data !== undefined) {
      this.initialLoading = false;
      if (data !== null) {
        this.dataLoading = true;
        this.quickContentDocumentVersionId = data;
      }
    }
    return null;
  }

  @wire(getRecord, {
    recordId: "$quickContentDocumentVersionId",
    fields: [CN_ID_FIELD, CN_CONTENT_FIELD]
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
