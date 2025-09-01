// SPDX-FileCopyrightText: Copyright (c) 2025 Logan Bussell
// SPDX-License-Identifier: MIT
// @ts-nocheck

window.onload = main;

// url is mutable because we replace it whenever we push or pop state from the
// browser history.
var url = new URL(window.location);

// Add new filter keys here. Each key must have a corresponding select element
// (<select id="{key}-filter">) in the HTML.
const imageFilters = ["repo", "version", "osfamily", "isdistroless", "globalization"];
const platformFilters = ["arch"];
const allFilters = [...imageFilters, ...platformFilters];

async function main() {
  const imagesList = document.getElementById("images-list");
  if (!imagesList) {
    return;
  }

  const ref = url.searchParams.get("ref") ?? "refs/heads/main";
  const file = url.searchParams.get("file") ?? "dotnet-dotnet-docker-main";

  // Fetch image data from GitHub
  const data = await getImageInfo(ref, file);

  // Render the data to the DOM
  const images = renderImages(data);
  images.forEach(documentFragment => imagesList.appendChild(documentFragment));

  // From here, we're going to do any the filtering based purely on the DOM.
  // Get all the rendered image entries back from the DOM.
  const imageEntries = imagesList.querySelectorAll("#image-entry");
  const platformEntries = imagesList.querySelectorAll("#platform-entry");

  // Central function to (re)apply all filters and enforce image/platform relationship.
  const applyFilters = () => {
    filterElements(imageEntries, imageFilters, url);
    filterElements(platformEntries, platformFilters, url);
    hideImagesWithoutVisiblePlatforms(imageEntries, platformEntries, url);
  };

  imageFilters.forEach(param => setupFiltering(
    imageEntries,
    param,
    url,
    applyFilters
  ));

  platformFilters.forEach(param => setupFiltering(
    platformEntries,
    param,
    url,
    applyFilters
  ));

  window.addEventListener("popstate", _ => {
    url = new URL(document.location);
    applyFilters();
    updateSelectValues(url);
  });

  // Start by applying any filters passed in via the URL
  applyFilters();
}

function renderImages(data) {

  const imageTemplate = document.getElementById("image-template");
  const platformTemplate = document.getElementById("platform-template");
  if (!imageTemplate || !platformTemplate) {
    return [];
  }

  const images = [];

  data.repos.forEach(repo => {
    repo.images.forEach(image => {

      const platform = image.platforms[0];
      const osType = platform.osType;
      const specificOs = platform.osVersion;

      var osFamily = "";
      if (specificOs.includes("noble") || specificOs.includes("jammy")) {
        osFamily = "Ubuntu";
      } else if (specificOs.includes("trixie") || specificOs.includes("bookworm")) {
        osFamily = "Debian";
      } else if (specificOs.includes("alpine")) {
        osFamily = "Alpine";
      } else if (specificOs.includes("azure")) {
        osFamily = "Azure Linux";
      } else if (specificOs.includes("cbl")) {
        osFamily = "CBL Mariner";
      } else if (specificOs.includes("servercore")) {
        osFamily = "Windows Server Core";
      } else if (specificOs.includes("nano")) {
        osFamily = "Windows Nano Server";
      } else {
        osFamily = "Other";
      }

      const isDistroless = specificOs.includes("distroless") || specificOs.includes("chisel");
      const isComposite = platform.simpleTags.some(tag => tag.includes("composite"));

      // Debian and Ubuntu non-distroless images include globalization libs by default
      const globalization = platform.simpleTags.some(tag => tag.includes("extra"))
        || (!isDistroless && (osFamily === "Ubuntu" || osFamily === "Debian"));

      const imageFragment = createImageFragment(repo.repo, image, imageTemplate, platformTemplate);
      const imageEntry = imageFragment.getElementById("image-entry");

      imageEntry.dataset.repo = repo.repo;
      imageEntry.dataset.os = specificOs;
      imageEntry.dataset.ostype = osType;
      imageEntry.dataset.osfamily = osFamily;
      imageEntry.dataset.isdistroless = isDistroless;
      imageEntry.dataset.globalization = globalization;
      imageEntry.dataset.iscomposite = isComposite;
      imageEntry.dataset.version = getMajorMinorVersion(image.productVersion);

      const platformsContainer = imageFragment.querySelector("#platforms");
      image.platforms.forEach(platform => {
        const platformFragment = createPlatformFragment(platform, platformTemplate);
        const platformEntry = platformFragment.getElementById("platform-entry");
        platformEntry.dataset.arch = platform.architecture;
        platformsContainer.appendChild(platformFragment);
      });

      images.push(imageFragment);
    });
  });

  return images;
}

/**
 * Create a DOM fragment for a single image including all its platforms.
 * @param {string} repoName
 * @param {object} image
 * @param {HTMLTemplateElement} imageTemplate
 * @param {HTMLTemplateElement} platformTemplate
 * @returns {DocumentFragment}
 */
function createImageFragment(repoName, image, imageTemplate, platformTemplate) {
  const fragment = imageTemplate.content.cloneNode(true);
  fragment.querySelectorAll("#repo-name").forEach(el => el.textContent = repoName);
  fragment.querySelector("#image-version").textContent = image.productVersion;

  const created = fragment.querySelector("#image-created");
  created.textContent = formatDate(image.manifest?.created);

  const imageOs = fragment.querySelector("#image-os")
  imageOs.textContent = image.platforms[0].osVersion || image.platforms[0].osType;
  imageOs.hidden = false;

  const manifest = image.manifest;
  if (manifest) {
    fragment.querySelector("#manifest-list-info").hidden = false;

    const sharedTags = image.manifest?.sharedTags;
    if (sharedTags) {
      sharedTags
        .sort((a, b) => b.length - a.length);
      fragment.querySelector("#image-shared-tags").innerHTML =
        sharedTags.map(wrapInCode).join(" ");

      const imageRef = fragment.querySelector("#image-ref");
      imageRef.textContent = `mcr.microsoft.com/${repoName}:${sharedTags[0]}`;
      imageRef.hidden = false;
    }
  }

  return fragment;
}

/**
 * Create a DOM fragment for a single platform variant.
 * @param {object} platform
 * @param {HTMLTemplateElement} platformTemplate
 * @returns {DocumentFragment}
 */
function createPlatformFragment(platform, platformTemplate) {
  const fragment = platformTemplate.content.cloneNode(true);
  fragment.querySelector("#platform-arch").textContent = platform.architecture;
  fragment.querySelector("#platform-total-size").textContent = formatBytes(sumLayerSizes(platform.layers));

  const imageRef = fragment.querySelector("#image-ref");
  imageRef.textContent = getShaPart(platform.digest);
  imageRef.hidden = false;

  const baseImage = fragment.querySelector("#platform-base-digest");
  baseImage.textContent = platform.baseImageDigest;
  baseImage.hidden = false;

  const created = fragment.querySelector("#platform-created");
  created.textContent = formatDate(platform.created);

  const dockerfileLink = fragment.querySelector("#platform-dockerfile");
  dockerfileLink.href = platform.commitUrl || "#";

  fragment.querySelector("#platform-tags").innerHTML =
    platform.simpleTags.map(wrapInCode).join(" ");

  return fragment;
}

function sumLayerSizes(layers = []) {
  return layers.reduce((a, l) => a + (l.size || 0), 0);
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let num = bytes;
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(num < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

async function getImageInfo(ref, file) {
  const url = `https://raw.githubusercontent.com/dotnet/versions/${ref}/build-info/docker/image-info.${file}.json`;
  const response = await fetch(url);
  return await response.json();
}

function getShaPart(fullImageRef) {
  const parts = fullImageRef.split("@");
  return parts.length > 1 ? parts[1] : "";
}

function wrapInCode(text) {
  return `<code class="code-bg">${text}</code>`;
}

function getUniqueDatasetValues(elementsWithData, key) {
  const uniqueValues = [];
  elementsWithData.forEach(element => {
    const data = element.dataset[key];

    // Skip empty / undefined values so we don't duplicate the "All" option.
    if ((data === undefined || data === "")) {
      return;
    }

    if (!uniqueValues.includes(data)) {
      uniqueValues.push(data);
    }
  });

  return uniqueValues;
}

function populateOptions(selectElement, options) {
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  selectElement.appendChild(allOption);

  options.forEach(optionValue => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    selectElement.appendChild(option);
  });
}

function filterElements(elementsWithData, allFilters, url) {
  elementsWithData.forEach(element => {
    var hidden = false;

    // Only show the element if it matches all the filters
    allFilters.forEach(filterKey => {
      if (hidden) {
        return;
      }

      const filterValue = url.searchParams.get(filterKey);
      const elementValue = element.dataset[filterKey];

      if (
        filterValue !== null
        && filterValue !== ""
        && elementValue !== filterValue
      ) {
        hidden = true;
      }
    });

    element.hidden = hidden;
  });
}

function setupFiltering(elementsWithData, thisFilter, url, applyFilters) {
  const select = getFilterSelectElement(thisFilter);
  if (!select) {
    return;
  }

  // Populate options with all unique values of data among the images list
  const options = getUniqueDatasetValues(elementsWithData, thisFilter);
  populateOptions(select, options);

  // Load the selector with the initial filter value, if it was passed in via the URL
  const urlParam = url.searchParams.get(thisFilter);
  if (urlParam && options.includes(urlParam)) {
    select.value = urlParam;
  }

  // When we change one of the selectors, we need to update the URL's search
  // params, filter the images, and then update the browser's URL
  select.addEventListener("change", ({ currentTarget }) => {
    // We don't want to show empty params in the URL
    if (currentTarget.value !== "") {
      url.searchParams.set(thisFilter, currentTarget.value);
    } else {
      url.searchParams.delete(thisFilter);
    }

    // Re-apply all filters so image visibility reflects platform filtering.
    applyFilters();
    window.history.pushState({}, "", url);
  });
}

function updateSelectValues(url) {
  imageFilters.forEach(filterKey => {
    const select = getFilterSelectElement(filterKey);
    const value = url.searchParams.get(filterKey) ?? "";
    if (select) {
      select.value = value;
    }
  });
}

function getFilterSelectElement(filterKey) {
  const id = `${filterKey}-filter`;
  const select = document.getElementById(id);

  if (!select) {
    console.error(`Element with id '${id}' not found.`);
  }

  return select;
}

// After platform filtering, hide any image entries that no longer have a
// visible platform. Only enforced when a platform filter (currently 'arch')
// is active, so clearing the platform filter restores images (subject to
// image-only filters).
function hideImagesWithoutVisiblePlatforms(imageEntries, platformEntries, url) {
  const archFilterActive = !!(url.searchParams.get("arch"));
  if (!archFilterActive) {
    return; // Nothing to do; images already filtered by image filters.
  }

  imageEntries.forEach(image => {
    if (image.hidden) {
      return; // Already hidden by image filters.
    }
    const platforms = image.querySelectorAll("#platform-entry");
    const anyVisible = Array.from(platforms).some(p => !p.hidden);
    if (!anyVisible) {
      image.hidden = true;
    }
  });
}

function getMajorMinorVersion(version) {
  if (!version) {
    return "";
  }

  // Extract the first two numeric portions (major.minor) ignoring patch / prerelease.
  const match = version.match(/^(\d+)\.(\d+)/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }

  return version; // Fallback: return as-is if it doesn't match expected pattern.
}
