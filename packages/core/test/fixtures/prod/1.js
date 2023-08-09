// Missing semicolon.
if (typeof parent === 'string') {
  parent = d.querySelectorAll(config.parent);
  if (parent.length > 1) {
      console.warn('WARNING: the given `parent` query(' + config.parent + ') matched more than one element, the first one will be used');
  }
  if (parent.length === 0) {
      throw 'ERROR: the given `parent` doesn\'t exists!';
  }
  parent = parent[0];
}