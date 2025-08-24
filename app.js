// SPDX-FileCopyrightText: Copyright (c) 2025 Logan Bussell
// SPDX-License-Identifier: MIT

window.onload = main;

async function main() {
  // These elements are updated later below
  const elements = {
    ref: document.getElementById("ref"),
    branch: document.getElementById("branch"),
    repos: document.getElementById("repos"),
  };

  const urlSearchParams = new URLSearchParams(window.location.search);
  const ref = urlSearchParams.get("ref") ?? "refs/heads/main";
  const branch = urlSearchParams.get("branch") ?? "main";

  if (elements.ref) {
    elements.ref.textContent = "Ref: " + ref;
  }

  if (elements.branch) {
    elements.branch.textContent = "Branch: " + branch;
  }

  const imageInfo = await getImageInfoJson(ref, branch);
  renderImageInfo(imageInfo);

  function renderImageInfo(imageInfo) {
    const reposElement = elements.repos;
    if (!reposElement) {
      return;
    }

    imageInfo.repos.forEach(repo => {
      const repoElement = document.createElement("li");
      const repoHtml = renderRepoHtml(repo);
      repoElement.innerHTML = repoHtml;
      reposElement.appendChild(repoElement);
    });
  }
}

function renderRepoHtml(repo) {
  const numberOfImages = repo.images.length;
  return `<strong>${repo.repo}</strong> - ${numberOfImages} images`;
}

async function getImageInfoJson(ref, branch) {
  // Example URLs:
  // https://raw.githubusercontent.com/dotnet/versions/refs/heads/main/build-info/docker/image-info.dotnet-dotnet-docker-main.json
  // https://raw.githubusercontent.com/dotnet/versions/273efa8f821c43a6f286dca1a99b26a6b5c7c5f4/build-info/docker/image-info.dotnet-dotnet-docker-main.json
  const file = `build-info/docker/image-info.dotnet-dotnet-docker-${branch}.json`;
  const imageInfoUrl = `https://raw.githubusercontent.com/dotnet/versions/${ref}/${file}`;
  const imageInfo = await fetchJson(imageInfoUrl);
  return imageInfo;
}

async function fetchJson(url) {
  const response = await fetch(url);
  return await response.json();
}
