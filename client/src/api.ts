export const fields =
	"currency items { confidence category name priceMinor vegetarian photo variants { name priceMinor } }";
export async function request<T>(
	baseURL: string,
	token: string,
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 50_000);
	try {
		const response = await fetch(`${baseURL}/graphql`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Review-Token": token },
			body: JSON.stringify({ query, variables }),
			signal: controller.signal,
		});
		if (response.status === 401)
			throw new Error("Enter the operator token from your local setup.");
		if (!response.ok)
			throw new Error(
				`Request failed (${response.status}). Nothing was confirmed saved.`,
			);
		const result = await response.json();
		if (result.errors?.length) throw new Error(result.errors[0].message);
		if (!result.data) throw new Error("The server returned no result.");
		return result.data as T;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError")
			throw new Error(
				"The request timed out. Reload saved menus before trying a save again.",
			);
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}
