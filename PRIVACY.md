# Privacy

Tab Volume processes the audio of a tab you explicitly choose to control. It routes that audio locally through a Web Audio gain node to adjust playback volume. It does not record, retain, upload, or sell audio.

The extension places its controls inside the selected webpage. It receives the tab's identity and may read its title to support the controls, without retaining or transmitting that information. It does not collect browsing history or include analytics, advertising, or external network requests.

Opacity and the volume-boost preference are stored in the browser's local extension storage. Volume levels are held in memory for the lifetime of each controlled tab. Reset releases its capture; closing a tab, disabling the extension, or restarting the browser also ends that session. Removing the extension clears its local preference storage.

Browser permissions are explained in the README. The extension does not request blanket website access, and incognito operation is disabled.

If payment, accounts, or other network services are added later, this document and the extension's disclosures will be updated to describe their actual behavior.
