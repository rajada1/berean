export interface PRInfo {
    organization: string;
    project: string;
    repository: string;
    pullRequestId: number;
    hostname?: string;
}
export interface PRDetails {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
}
export interface PRDiffResult {
    success: boolean;
    diff?: string;
    prDetails?: PRDetails;
    error?: string;
}
/**
 * Parse Azure DevOps PR URL into components
 */
export declare function parsePRUrl(url: string): PRInfo | null;
/**
 * Fetch PR diff from Azure DevOps
 */
export declare function fetchPRDiff(prInfo: PRInfo): Promise<PRDiffResult>;
export interface PostCommentResult {
    success: boolean;
    threadId?: number;
    error?: string;
}
export interface BereanComment {
    threadId: number;
    commentId: number;
    content: string;
    createdDate: string;
    reviewedCommits?: string[];
}
/**
 * Find existing Berean review comments on a PR
 */
export declare function findBereanComments(prInfo: PRInfo): Promise<BereanComment[]>;
/**
 * Add reviewed commits tag to a comment
 */
export declare function addReviewedCommitsTag(comment: string, commitIds: string[]): string;
/**
 * Get all commit IDs for a PR
 */
export declare function getPRCommits(prInfo: PRInfo): Promise<string[]>;
/**
 * Check if PR description contains ignore keyword
 */
export declare function shouldIgnorePR(description: string | undefined): boolean;
/**
 * Update an existing Berean comment (for incremental reviews)
 */
export declare function updatePRComment(prInfo: PRInfo, threadId: number, commentId: number, newContent: string): Promise<PostCommentResult>;
export interface InlineComment {
    filePath: string;
    line: number;
    content: string;
}
/**
 * Post a general comment to a PR
 */
export declare function postPRComment(prInfo: PRInfo, comment: string): Promise<PostCommentResult>;
/**
 * Post an inline comment to a specific file/line in a PR
 */
export declare function postInlineComment(prInfo: PRInfo, filePath: string, line: number, content: string): Promise<PostCommentResult>;
/**
 * Post multiple inline comments
 */
export declare function postInlineComments(prInfo: PRInfo, comments: InlineComment[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
}>;
//# sourceMappingURL=azure-devops.d.ts.map