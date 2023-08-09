// Unterminated string constant
if (isSvg) {
  let source = serializeString(svgNode);
  // add xml declaration
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  // convert svg source to URI data scheme.
  url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  saveAs(url, "graph.svg");
  onAlreadySerialized();
  return;
}