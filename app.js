// SPDX-FileCopyrightText: Copyright (c) 2025 Logan Bussell
// SPDX-License-Identifier: MIT
// @ts-nocheck

window.onload = main;

async function main() {

  const imagesRoot = document.getElementById("images-root");
  if (!imagesRoot) {
    return;
  }

  const data = await getImageInfo();

  const images = renderImages(data);
  images.forEach(documentFragment => imagesRoot.appendChild(documentFragment));
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
      if (specificOs.includes("azure")) {
        osFamily = "Azure Linux";
      } else if (specificOs.includes("noble") || specificOs.includes("jammy")) {
        osFamily = "Ubuntu";
      } else if (specificOs.includes("trixie") || specificOs.includes("bookworm")) {
        osFamily = "Debian";
      } else if (specificOs.includes("alpine")) {
        osFamily = "Alpine";
      } else if (specificOs.includes("servercore")) {
        osFamily = "Windows Server Core";
      } else if (specificOs.includes("nano")) {
        osFamily = "Windows Nano Server";
      }

      const architectures = image.platforms.map(p => p.architecture);
      const isDistroless = specificOs.includes("distroless") || specificOs.includes("chisel");
      const isComposite = platform.simpleTags.some(tag => tag.includes("composite"));

      // Debian and Ubuntu non-distroless images include globalization libs by default
      const supportsGlobalization = platform.simpleTags.some(tag => tag.includes("extra"))
        || (!isDistroless && (osFamily === "Ubuntu" || osFamily === "Debian"));

      const imageFragment = createImageFragment(repo.repo, image, imageTemplate, platformTemplate);
      const imageEntry = imageFragment.getElementById("image-entry");

      imageEntry.dataset.os = specificOs;
      imageEntry.dataset.osType = osType;
      imageEntry.dataset.osFamily = osFamily;
      imageEntry.dataset.architectures = architectures;
      imageEntry.dataset.isDistroless = isDistroless;
      imageEntry.dataset.supportsGlobalization = supportsGlobalization;
      imageEntry.dataset.isComposite = isComposite;

      images.push(imageFragment);
    });
  });

  console.log(images);
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

  /**
   * Create a DOM fragment for a single platform variant.
   * @param {object} platform
   * @param {HTMLTemplateElement} platformTemplate
   * @returns {DocumentFragment}
   */
  function createPlatformElement(platform, platformTemplate) {
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

  const platformsUl = fragment.querySelector("#platforms");
  (image.platforms || []).forEach(platform => {
    const platformEl = createPlatformElement(platform, platformTemplate);
    platformsUl.appendChild(platformEl);
  });
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

async function getImageInfo() {
  const url = "https://raw.githubusercontent.com/dotnet/versions/refs/heads/main/build-info/docker/image-info.dotnet-dotnet-docker-main.json";
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
