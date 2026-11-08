const form = document.getElementById("profileForm");
const result = document.getElementById("profileResult");
const fileInput = document.getElementById("logoFile");
const uploadButton = document.getElementById("uploadButton");
const statusText = document.getElementById("uploadStatus");
const logoPreview = document.getElementById("logoPreview");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const age = Number(document.getElementById("age").value);
  if (!name || !Number.isInteger(age) || age < 1 || age > 120) return;
  result.textContent = `Name: ${name} | Age: ${age}`;
  result.hidden = false;
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  logoPreview.replaceChildren();
  const img = document.createElement("img");
  img.alt = "Selected logo preview";
  img.src = URL.createObjectURL(file);
  logoPreview.appendChild(img);
});

uploadButton.addEventListener("click", async () => {
  const file = fileInput.files[0];
  statusText.textContent = "";
  if (!file) { statusText.textContent = "Please choose an image first."; return; }
  if (file.size > 5 * 1024 * 1024) { statusText.textContent = "Image must be 5 MB or smaller."; return; }

  uploadButton.disabled = true;
  statusText.textContent = "Preparing upload...";
  try {
    const response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not prepare upload.");

    statusText.textContent = "Uploading image to S3...";
    const upload = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file
    });
    if (!upload.ok) throw new Error("S3 upload failed. Check bucket CORS and permissions.");

    statusText.textContent = `Upload successful. S3 object key: ${data.key}`;
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    uploadButton.disabled = false;
  }
});