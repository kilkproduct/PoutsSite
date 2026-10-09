// Shared page behavior: mobile navigation, command search, and the cookie notice.

(function initMobileNavigation() {
  var toggle = document.querySelector('.menu-toggle');
  var navigation = document.getElementById('primary-navigation');
  if (!toggle || !navigation) return;

  function setOpen(open) {
    navigation.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  navigation.addEventListener('click', function (event) {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', function (event) {
    if (toggle.getAttribute('aria-expanded') === 'true' &&
        !navigation.contains(event.target) &&
        !toggle.contains(event.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 800) setOpen(false);
  });
})();

(function initCommandSearch() {
  var search = document.getElementById('command-search');
  var list = document.getElementById('command-list');
  var filterContainer = document.getElementById('category-filters');
  if (!search || !list || !filterContainer) return;

  var listHeader = document.querySelector('.command-list-header');
  var emptyState = document.getElementById('command-empty');
  var loadError = document.getElementById('command-load-error');
  var countLabel = document.getElementById('command-count');
  var activeFilter = 'all';
  var categories = [];
  var groups = [];
  var totalCommands = 0;
  var topLevelCommands = 0;

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function parseCommandData(markdown) {
    var parsedCategories = [];
    var currentCategory = null;

    markdown.split(/\r?\n/).forEach(function (line) {
      var heading = /^## (.+)$/.exec(line);
      if (heading) {
        if (heading[1] === 'Notes') {
          currentCategory = null;
          return;
        }
        currentCategory = {
          id: slugify(heading[1]),
          name: heading[1],
          commands: []
        };
        parsedCategories.push(currentCategory);
        return;
      }

      if (!currentCategory || !/^\|\s*`\//.test(line)) return;
      var cells = line.split('|').slice(1, -1).map(function (cell) {
        return cell.trim();
      });
      var command = cells.length >= 3 ? /^`\/([^`]+)`$/.exec(cells[0]) : null;
      if (!command) return;

      currentCategory.commands.push({
        path: command[1],
        description: cells[1],
        requires: cells[2]
      });
    });

    return parsedCategories.filter(function (category) {
      return category.commands.length > 0;
    });
  }

  function createFilter(label, value, isPressed) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-button';
    button.dataset.filter = value;
    button.setAttribute('aria-pressed', String(isPressed));
    button.textContent = label;
    filterContainer.appendChild(button);
  }

  function renderCommandGroups() {
    var rootNames = Object.create(null);
    groups = [];
    list.textContent = '';
    filterContainer.textContent = '';
    createFilter('All', 'all', true);

    categories.forEach(function (category) {
      createFilter(category.name, category.id, false);

      var section = document.createElement('section');
      section.className = 'command-group';
      section.dataset.category = category.id;

      var heading = document.createElement('h3');
      heading.className = 'command-group-title';
      heading.id = 'command-group-' + category.id;
      heading.appendChild(document.createTextNode(category.name));

      var categoryCount = document.createElement('span');
      categoryCount.className = 'category-count';
      categoryCount.textContent = category.commands.length + (category.commands.length === 1 ? ' command' : ' commands');
      heading.appendChild(categoryCount);

      var commandList = document.createElement('ul');
      commandList.className = 'command-list';
      commandList.setAttribute('aria-labelledby', heading.id);
      var group = { id: category.id, element: section, items: [] };

      category.commands.forEach(function (command) {
        var item = document.createElement('li');
        item.className = 'command-item';
        item.dataset.search = ('/' + command.path + ' ' + category.name + ' ' + command.description + ' ' + command.requires).toLowerCase();

        var name = document.createElement('code');
        name.className = 'command-name';
        name.textContent = '/' + command.path;

        var description = document.createElement('p');
        description.className = 'command-description';
        description.textContent = command.description;

        var requirement = document.createElement('span');
        requirement.className = 'command-requirement';
        var requirementLabel = document.createElement('span');
        requirementLabel.className = 'requirement-label';
        requirementLabel.textContent = 'Requires: ';
        requirement.appendChild(requirementLabel);
        requirement.appendChild(document.createTextNode(command.requires));

        item.appendChild(name);
        item.appendChild(description);
        item.appendChild(requirement);
        commandList.appendChild(item);
        group.items.push(item);

        var rootName = command.path.split(/\s+/)[0];
        rootNames[rootName] = true;
      });

      section.appendChild(heading);
      section.appendChild(commandList);
      list.appendChild(section);
      groups.push(group);
    });

    totalCommands = groups.reduce(function (total, group) {
      return total + group.items.length;
    }, 0);
    topLevelCommands = Object.keys(rootNames).length;
  }

  function applyFilters() {
    var query = search.value.trim().toLowerCase();
    var visibleCount = 0;

    groups.forEach(function (group) {
      var categoryMatches = activeFilter === 'all' || group.id === activeFilter;
      var groupCount = 0;

      group.items.forEach(function (item) {
        var queryMatches = !query || item.dataset.search.indexOf(query) !== -1;
        var isVisible = categoryMatches && queryMatches;
        item.hidden = !isVisible;
        if (isVisible) {
          visibleCount += 1;
          groupCount += 1;
        }
      });

      group.element.hidden = groupCount === 0;
    });

    if (emptyState) emptyState.hidden = visibleCount !== 0;
    if (countLabel) {
      countLabel.textContent = query || activeFilter !== 'all'
        ? 'Showing ' + visibleCount + ' of ' + totalCommands + ' command paths'
        : topLevelCommands + ' top-level commands · ' + totalCommands + ' command paths · ' + categories.length + ' categories';
    }
  }

  search.addEventListener('input', applyFilters);

  if (filterContainer) {
    filterContainer.addEventListener('click', function (event) {
      var filter = event.target.closest('.filter-button');
      if (!filter || !filterContainer.contains(filter)) return;

      activeFilter = filter.dataset.filter || 'all';
      Array.prototype.forEach.call(filterContainer.querySelectorAll('.filter-button'), function (candidate) {
        candidate.setAttribute('aria-pressed', String(candidate === filter));
      });
      applyFilters();
    });
  }

  fetch('commands-data.md')
    .then(function (response) {
      if (!response.ok) throw new Error('Unable to load command data.');
      return response.text();
    })
    .then(function (markdown) {
      categories = parseCommandData(markdown);
      if (!categories.length) throw new Error('No commands were found.');
      renderCommandGroups();
      if (listHeader) listHeader.hidden = false;
      list.hidden = false;
      applyFilters();
      if (loadError) loadError.hidden = true;
    })
    .catch(function () {
      if (countLabel) countLabel.textContent = 'Command list unavailable';
      if (loadError) loadError.hidden = false;
    });
})();

(function initConsent() {
  var KEY = 'pouts-consent';
  var banner = document.getElementById('consent');
  if (!banner) return;

  var stored = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch (error) {
    // Storage can be unavailable in private browsing or restricted contexts.
  }

  if (stored) {
    document.documentElement.setAttribute('data-consent', stored);
    return;
  }

  banner.hidden = false;

  function choose(level) {
    try {
      window.localStorage.setItem(KEY, level);
    } catch (error) {
      // The banner should still dismiss for this page view if storage is blocked.
    }
    document.documentElement.setAttribute('data-consent', level);
    banner.hidden = true;
  }

  var accept = document.getElementById('consent-accept');
  var essential = document.getElementById('consent-essential');
  if (accept) accept.addEventListener('click', function () { choose('accepted'); });
  if (essential) essential.addEventListener('click', function () { choose('essential'); });
})();
