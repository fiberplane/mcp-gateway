/**
 * Filter bar with search input, active filter badges, and controls.
 * Filter state is synced with URL parameters via nuqs.
 */

import type { createFilter } from "@fiberplane/mcp-gateway-types";
import { useQueryState, useQueryStates } from "nuqs";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
	addOrReplaceFilter,
	removeFilter,
} from "../lib/filter-utils";
import {
	filterParamsToFilters,
	filtersToFilterParams,
	parseAsFilterParam,
	parseAsSearch,
} from "../lib/filter-parsers";
import { AddFilterDropdown } from "./add-filter-dropdown";
import { FilterBadge } from "./filter-badge";
import { SearchInput } from "./search-input";

interface FilterBarProps {
	/**
	 * Optional action buttons to display on the right side of search row
	 * (e.g., StreamingBadge, SettingsMenu, ExportButton)
	 */
	actions?: ReactNode;
}

export function FilterBar({ actions }: FilterBarProps) {
	// Live region announcement for screen readers
	const [announcement, setAnnouncement] = useState("");

	// URL state management via nuqs
	const [search, setSearch] = useQueryState("q", parseAsSearch);

	const [filterParams, setFilterParams] = useQueryStates(
		{
			client: parseAsFilterParam,
			method: parseAsFilterParam,
			session: parseAsFilterParam,
			server: parseAsFilterParam,
			duration: parseAsFilterParam,
			tokens: parseAsFilterParam,
		},
		{
			history: "replace", // Use replaceState instead of pushState
		},
	);

	// Convert URL params to Filter array
	const filters = useMemo(
		() => filterParamsToFilters(filterParams),
		[filterParams],
	);

	// Update live region announcement when filters change
	useEffect(() => {
		const count = filters.length;
		if (count === 0) {
			setAnnouncement("All filters cleared");
		} else if (count === 1) {
			setAnnouncement("1 filter active");
		} else {
			setAnnouncement(`${count} filters active`);
		}
	}, [filters.length]);

	const handleRemoveFilter = (filterId: string) => {
		const updatedFilters = removeFilter(filters, filterId);
		const newParams = filtersToFilterParams(updatedFilters);
		setFilterParams(newParams);
	};

	const handleAddFilter = (filter: ReturnType<typeof createFilter>) => {
		const updatedFilters = addOrReplaceFilter(filters, filter);
		const newParams = filtersToFilterParams(updatedFilters);
		setFilterParams(newParams);
	};

	const handleRemoveFilterByField = (field: string) => {
		const updatedFilters = filters.filter((f) => f.field !== field);
		const newParams = filtersToFilterParams(updatedFilters);
		setFilterParams(newParams);
	};

	const handleSearchChange = (newSearch: string) => {
		setSearch(newSearch);
	};

	const handleClearAll = () => {
		// Only clear filters, preserve search (UX principle: button position = button scope)
		setFilterParams({
			client: null,
			method: null,
			session: null,
			server: null,
			duration: null,
			tokens: null,
		});
	};

	// Show "Clear all" button only when there are active filters
	// (not when search has text - search is cleared via its own X button)
	const hasActiveFilters = filters.length > 0;

	return (
		<>
			{/* Visually hidden live region for screen reader announcements */}
			{/* biome-ignore lint/a11y/useSemanticElements: div with role="status" is the correct ARIA pattern for live regions */}
			<div
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{announcement}
			</div>

			<div className="flex flex-col gap-3">
				{/* Row 1: Search input + Action buttons */}
				<div className="flex items-center gap-3">
					<SearchInput
						value={search ?? ""}
						onChange={handleSearchChange}
						placeholder="Search logs..."
						className="flex-1"
					/>
					{actions}
				</div>

				{/* Row 2: Filters */}
				<div className="flex items-center gap-2 flex-wrap">
					{/* Add filter button - always first for stable position */}
					<AddFilterDropdown
						onAdd={handleAddFilter}
						onRemove={handleRemoveFilterByField}
						activeFilters={filters}
					/>

					{/* Active filter badges */}
					{filters.map((filter) => (
						<FilterBadge
							key={filter.id}
							filter={filter}
							onRemove={handleRemoveFilter}
						/>
					))}

					{/* Clear all button - positioned right after filter badges */}
					{hasActiveFilters && (
						<button
							type="button"
							onClick={handleClearAll}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
						>
							Clear all
						</button>
					)}
				</div>
			</div>
		</>
	);
}
