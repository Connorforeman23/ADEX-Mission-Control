// Printing the Space Order and the invoice.
//
// Two things the browser does by default that the documents must not carry:
//
//   1. The PDF is named after the page title, so "Save as PDF" offered
//      "ADEX Mission Control.pdf". Rick wants VCC0002.pdf. The title is swapped
//      for the duration of the print and put back afterwards.
//
//   2. The URL, date and page count printed in the corners live in the page
//      margin. Setting `@page { margin: 0 }` (see globals.css) leaves them
//      nowhere to go, and the sheet supplies its own margin instead.

export function printAs(title: string) {
  const previous = document.title;
  document.title = title.replace(/[\\/:*?"<>|]+/g, "-");
  // Restore on afterprint rather than straight after print(): Chrome's print
  // dialog is modal, but Safari's is not, and the filename is read when the
  // user confirms — not when the dialog opens.
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
