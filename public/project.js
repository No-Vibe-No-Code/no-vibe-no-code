(() => {
  const query = new URLSearchParams(location.search);
  const project = query.get('project');
  if (project) {
    query.delete('project');
    location.replace('/projects/' + encodeURIComponent(project) + (query.size ? '?' + query : ''));
  } else {
    location.replace('/gallery');
  }
})();
