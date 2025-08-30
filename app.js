// SPDX-FileCopyrightText: Copyright (c) 2025 Logan Bussell
// SPDX-License-Identifier: MIT

window.onload = main;

async function main() {

  const reposElement = document.getElementById("repos");
  if (!reposElement) {
    return;
  }

  const imageInfo = await getImageInfo();

  imageInfo.repos.forEach(repo => {
    const repoElement = document.createElement("li");
    const repoHtml = renderRepoHtml(repo);
    repoElement.innerHTML = repoHtml;
    reposElement.appendChild(repoElement);
  });
}

function renderRepoHtml(repo) {
  const numberOfImages = repo.images.length;
  return `<strong>${repo.repo}</strong> - ${numberOfImages} images`;
}

async function getImageInfo() {
  const url = "image-info.dotnet-dotnet-docker-main.json"
  const response = await fetch(url);
  return await response.json();
}
