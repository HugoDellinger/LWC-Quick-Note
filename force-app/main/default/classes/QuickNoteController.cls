public with sharing class QuickNoteController {
  @AuraEnabled(cacheable=true)
  public static Id retrieveQuickContentDocumentIdForRecordId(Id recordId) {
    List<ContentDocumentLink> contentDocumentLinks = [
      SELECT ContentDocumentLink.ContentDocument.Id
      FROM ContentDocumentLink
      WHERE
        LinkedEntityId = :recordId
        AND ContentDocument.LatestPublishedVersion.FileType = 'SNOTE'
        AND ContentDocument.LatestPublishedVersion.Title LIKE 'QuickNot%'
      ORDER BY ContentDocument.CreatedDate DESC
      LIMIT 1
    ];

    if (contentDocumentLinks.size() == 0)
      return null;
    return contentDocumentLinks[0].ContentDocument.Id;
  }
}
