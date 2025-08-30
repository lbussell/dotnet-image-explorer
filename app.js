// SPDX-FileCopyrightText: Copyright (c) 2025 Logan Bussell
// SPDX-License-Identifier: MIT
// @ts-nocheck

window.onload = main;

async function main() {
  const data = await getImageInfo();
  const fragments = renderImages(data);
  const imagesRoot = document.getElementById("images-root");
  if (imagesRoot) {
    fragments.forEach(f => imagesRoot.appendChild(f));
  }
}

function renderImages(data) {
  const imageTemplate = document.getElementById("image-template");
  const platformTemplate = document.getElementById("platform-template");
  if (!imageTemplate || !platformTemplate) return [];
  const fragments = [];
  data.repos.forEach(repo => {
    repo.images.forEach(image => {
      const imageFragment = createImageElement(repo.repo, image, imageTemplate, platformTemplate);
      fragments.push(imageFragment);
    });
  });
  return fragments;
}

/**
 * Create a DOM fragment for a single platform variant.
 * @param {object} platform
 * @param {HTMLTemplateElement} platformTemplate
 * @returns {DocumentFragment}
 */
function createPlatformElement(platform, platformTemplate) {
  const platformFragment = platformTemplate.content.cloneNode(true);
  platformFragment.querySelector("#platform-arch").textContent = platform.architecture;
  platformFragment.querySelector("#platform-os").textContent = platform.osVersion || platform.osType;
  platformFragment.querySelector("#platform-layer-count").textContent = platform.layers?.length || 0;
  platformFragment.querySelector("#platform-total-size").textContent = formatBytes(sumLayerSizes(platform.layers));
  platformFragment.querySelector("#platform-digest").textContent = platform.digest;
  platformFragment.querySelector("#platform-base-digest").textContent = platform.baseImageDigest || "";
  platformFragment.querySelector("#platform-created").textContent = formatDate(platform.created);
  const dockerfileLink = platformFragment.querySelector("#platform-dockerfile");
  dockerfileLink.textContent = platform.dockerfile;
  dockerfileLink.href = platform.commitUrl || "#";
  platformFragment.querySelector("#platform-tags").textContent = (platform.simpleTags || []).join(", ");
  const layersOl = platformFragment.querySelector("#layers");
  (platform.layers || []).forEach(layer => {
    const li = document.createElement("li");
    li.innerHTML = `<code>${layer.digest}</code> - ${formatBytes(layer.size)}`;
    layersOl.appendChild(li);
  });
  return platformFragment;
}

/**
 * Create a DOM fragment for a single image including all its platforms.
 * @param {string} repoName
 * @param {object} image
 * @param {HTMLTemplateElement} imageTemplate
 * @param {HTMLTemplateElement} platformTemplate
 * @returns {DocumentFragment}
 */
function createImageElement(repoName, image, imageTemplate, platformTemplate) {
  const imageFragment = imageTemplate.content.cloneNode(true);
  imageFragment.querySelectorAll("#repo-name").forEach(el => el.textContent = repoName);
  imageFragment.querySelector("#image-version").textContent = image.productVersion;
  imageFragment.querySelector("#image-platform-count").textContent = image.platforms?.length || 0;
  imageFragment.querySelector("#image-created").textContent = formatDate(image.manifest?.created);
  imageFragment.querySelector("#image-shared-tags").textContent = (image.manifest?.sharedTags || []).join(", ");
  const platformsUl = imageFragment.querySelector("#platforms");
  (image.platforms || []).forEach(platform => {
    const platformEl = createPlatformElement(platform, platformTemplate);
    platformsUl.appendChild(platformEl);
  });
  return imageFragment;
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

async function getImageInfo() {
  const url = "image-info.dotnet-dotnet-docker-main.json"
  const response = await fetch(url);
  return await response.json();
}
