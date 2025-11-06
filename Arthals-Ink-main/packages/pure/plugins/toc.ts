import type { MarkdownHeading } from 'astro'

export interface TocItem extends MarkdownHeading {
  subheadings: TocItem[]
}

function diveChildren(item: TocItem, depth: number): TocItem[] {
  // Safety checks
  if (!item || typeof item !== 'object') {
    console.warn('Invalid item passed to diveChildren:', item)
    return []
  }
  
  if (depth <= 1 || !item.subheadings || !Array.isArray(item.subheadings) || !item.subheadings.length) {
    return item.subheadings || []
  } else {
    // e.g., 2
    const lastSubheading = item.subheadings[item.subheadings.length - 1]
    if (!lastSubheading || typeof lastSubheading !== 'object') {
      return item.subheadings
    }
    
    // Prevent infinite recursion
    if (depth > 10) {
      console.warn('Maximum recursion depth reached in diveChildren')
      return item.subheadings
    }
    
    return diveChildren(lastSubheading as TocItem, depth - 1)
  }
}

export function generateToc(headings: readonly MarkdownHeading[]) {
  // Ensure headings is an array and filter out null/undefined values
  if (!headings || !Array.isArray(headings)) {
    console.warn('Invalid headings provided to generateToc:', headings)
    return []
  }

  // Include all headings (including h1 elements)
  const bodyHeadings = [...headings].filter(h => {
    // More strict validation
    return h && 
           typeof h === 'object' && 
           typeof h.depth === 'number' && 
           h.depth >= 1 && 
           h.depth <= 10 &&
           h.text !== undefined
  })
  
  const toc: TocItem[] = []

  bodyHeadings.forEach((h) => {
    // Additional safety check before spreading
    if (!h || typeof h !== 'object') {
      console.warn('Invalid heading object:', h)
      return
    }

    const heading: TocItem = { ...h, subheadings: [] }

    // Validate heading depth
    if (!heading.depth || typeof heading.depth !== 'number') {
      console.warn(`Invalid heading depth for: ${heading.text}`, heading)
      return
    }

    // add h1 and h2 elements into the top level
    if (heading.depth === 1 || heading.depth === 2) {
      toc.push(heading)
    } else {
      const lastItemInToc = toc[toc.length - 1]
      if (!lastItemInToc) {
        console.warn(`No parent heading found for depth ${heading.depth}: ${heading.text}`)
        // Add as top level instead of throwing error
        toc.push(heading)
        return
      }
      
      if (!lastItemInToc.depth || typeof lastItemInToc.depth !== 'number') {
        console.warn(`Invalid parent heading depth for: ${heading.text}`, lastItemInToc)
        toc.push(heading)
        return
      }
      
      if (heading.depth < lastItemInToc.depth) {
        console.warn(`Orphan heading found: ${heading.text}. Adding as top level.`)
        toc.push(heading)
        return
      }

      // higher depth
      // push into children, or children's children
      const gap = heading.depth - lastItemInToc.depth
      try {
        const target = diveChildren(lastItemInToc, gap)
        if (target && Array.isArray(target)) {
          target.push(heading)
        } else {
          console.warn(`Invalid target returned from diveChildren for heading: ${heading.text}`)
          toc.push(heading) // Fallback to top level
        }
      } catch (error) {
        console.warn(`Error processing heading "${heading.text}":`, error)
        toc.push(heading) // Fallback to top level
      }
    }
  })
  return toc
}
