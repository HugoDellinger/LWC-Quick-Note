import { LightningElement, wire, api, track } from "lwc";
import { updateRecord, createRecord, getRecord } from "lightning/uiRecordApi";
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
  isSaving = false;
  get isLoading() {
    return this.initialLoading === true || this.isSaving === true;
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
    return this.isContentSameAsBefore === true || this.isLoading === true;
  }

  async insertNote() {
    const fields = {
      [CN_CONTENT_FIELD.fieldApiName]: window.btoa(this.htmlContent),
      [CN_TITLE_FIELD.fieldApiName]: "QuickNote"
    };
    this.noteRecord = await createRecord({
      apiName: CN_OBJECT.objectApiName,
      fields
    });
    this.noteRecordContent = this.htmlContent;
    await createNoteLink({
      noteId: this.noteRecord.id,
      recordId: this.recordId
    });
  }

  async updateNote() {
    const fields = {
      [CN_ID_FIELD.fieldApiName]: this.noteRecord.id,
      [CN_CONTENT_FIELD.fieldApiName]: window.btoa(this.htmlContent),
      [CN_TITLE_FIELD.fieldApiName]: "QuickNote"
    };
    this.noteRecord = await updateRecord({ fields });
    this.noteRecordContent = this.htmlContent;
  }

  // # Save data
  async handleSave() {
    if (this.isContentSameAsBefore === true || this.isLoading === true) return; // don't save if the content is the same as before
    try {
      this.isSaving = true;
      if (this.noteRecord == null) {
        await this.insertNote();
      } else {
        await this.updateNote();
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
    if (this.initialLoading === true && data !== undefined) {
      if (data !== null) {
        this.quickContentDocumentVersionId = data;
      } else {
        this.initialLoading = false;
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
    if (this.initialLoading === true && data !== undefined) {
      this.noteRecord = data;
      if (this.noteRecord != null) {
        const encodedContent = this.noteRecord.fields.Content.value;
        this.htmlContent = window.atob(encodedContent);
        this.template.querySelector(
          "lightning-input-rich-text"
        ).value = this.htmlContent; // The content is not binded to prevent loss of focus on rerender
        this.noteRecordContent = this.htmlContent;
      } else {
        this.htmlContent = null;
        this.noteRecordContent = null;
      }
      this.initialLoading = false;
    }
    return null;
  }
}
