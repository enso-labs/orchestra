import debug from "debug";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/utils/apiClient";

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

debug.enable("hooks:*");

const INIT_IMAGE_STATE = {
	images: [],
	previewImage: null,
	previewImageIndex: 0,
};

export default function useImageHook() {
	const [images, setImages] = useState<File[]>(INIT_IMAGE_STATE.images);
	const [previewImage, setPreviewImage] = useState<File | null>(
		INIT_IMAGE_STATE.previewImage,
	);
	const [previewImageIndex, setPreviewImageIndex] = useState<number>(
		INIT_IMAGE_STATE.previewImageIndex,
	);

	const uploadImages = async (files: File[]): Promise<string[]> => {
		const formData = new FormData();
		files.forEach((file) => {
			// Create a new file with timestamped name
			const timestamp = Math.floor(Date.now()); // Unix timestamp
			const newFileName = `${timestamp}_${file.name}`;
			const newFile = new File([file], newFileName, { type: file.type });
			formData.append("files", newFile);
		});

		try {
			const response = await apiClient.post("/storage/presigned", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			});
			if (response.data.status === "success") {
				return response.data.files.map((file: any) => file);
			}
			throw new Error("Failed to upload images");
		} catch (error) {
			console.error("Error uploading images:", error);
			toast.error("Failed to upload images");
			return [];
		}
	};

	const addImages = useCallback(
		async (files: File[]) => {
			if (!files.length) return;

			// Filter for only images and check file size
			const validImages = files.filter((file) => {
				if (!file.type.startsWith("image/")) {
					toast.error(`${file.name} is not an image file`);
					return false;
				}
				if (file.size > MAX_IMAGE_SIZE) {
					toast.error(
						`${file.name} is too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`,
					);
					return false;
				}
				return true;
			});

			setImages((currentImages) => {
				const newImages = [...currentImages];
				validImages.some((file) => {
					if (newImages.length >= MAX_IMAGES) {
						toast.error(`Maximum ${MAX_IMAGES} images allowed`);
						return true;
					}
					// Check for duplicates by name and size
					if (
						!newImages.some(
							(existing) =>
								existing.name === file.name && existing.size === file.size,
						)
					) {
						newImages.push(file);
					}
					return false;
				});
				return newImages;
			});

			// Upload images and get presigned URLs
			await uploadImages(validImages);

			// setImages((prev: any) => [...prev, ...validImages]);
		},
		[setImages],
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const imageFiles: File[] = [];
			for (const item of items) {
				if (item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) imageFiles.push(file);
				}
			}
			addImages(imageFiles);
		},
		[addImages],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const items = Array.from(e.dataTransfer?.files || []);
			addImages(items);
		},
		[addImages],
	);

	const removeImage = useCallback(
		(index: number) => {
			setImages((currentImages) => currentImages.filter((_, i) => i !== index));
		},
		[setImages],
	);

	const handleImageClick = useCallback((image: File, index: number) => {
		setPreviewImage(image);
		setPreviewImageIndex(index);
	}, []);

	const handleImageClear = useCallback(() => {
		setPreviewImage(null);
		setPreviewImageIndex(0);
	}, []);

	return {
		images,
		previewImage,
		previewImageIndex,
		uploadImages,
		addImages,
		setImages,
		handlePaste,
		handleDrop,
		removeImage,
		handleImageClick,
		handleImageClear,
		setPreviewImage,
	};
}
