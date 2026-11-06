/**
 * Small dense linear algebra for CMA-ES (n typically &lt; 50).
 */

export function matZeros(n: number): number[][] {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

export function matEye(n: number): number[][] {
  const M = matZeros(n);
  for (let i = 0; i < n; i += 1) M[i]![i]! = 1;
  return M;
}

export function vecZeros(n: number): number[] {
  return Array(n).fill(0);
}

export function vecCopy(v: readonly number[]): number[] {
  return v.slice();
}

export function symmetrize(C: readonly (readonly number[])[]): number[][] {
  const n = C.length;
  const S = matZeros(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      S[i]![j]! = 0.5 * ((C[i]?.[j] ?? 0) + (C[j]?.[i] ?? 0));
    }
  }
  return S;
}

export function matVecMul(M: readonly (readonly number[])[], v: readonly number[]): number[] {
  const n = M.length;
  const out = vecZeros(n);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    const row = M[i]!;
    for (let j = 0; j < n; j += 1) {
      sum += row[j]! * v[j]!;
    }
    out[i] = sum;
  }
  return out;
}

export function vecSub(a: readonly number[], b: readonly number[]): number[] {
  const n = a.length;
  const out = vecZeros(n);
  for (let i = 0; i < n; i += 1) out[i] = a[i]! - b[i]!;
  return out;
}

export function vecScale(v: readonly number[], s: number): number[] {
  return v.map((x) => x * s);
}

export function vecMultiply(a: readonly number[], b: readonly number[]): number[] {
  const n = a.length;
  const out = vecZeros(n);
  for (let i = 0; i < n; i += 1) out[i] = a[i]! * b[i]!;
  return out;
}

export function vecDot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i]! * b[i]!;
  return s;
}

export function vecNorm(a: readonly number[]): number {
  return Math.sqrt(vecDot(a, a));
}

export function outer(a: readonly number[], b: readonly number[]): number[][] {
  const n = a.length;
  const M = matZeros(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      M[i]![j]! = a[i]! * b[j]!;
    }
  }
  return M;
}

export function matAdd(A: readonly (readonly number[])[], B: readonly (readonly number[])[]): number[][] {
  const n = A.length;
  const R = matZeros(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      R[i]![j]! = (A[i]?.[j] ?? 0) + (B[i]?.[j] ?? 0);
    }
  }
  return R;
}

export function matScale(A: readonly (readonly number[])[], s: number): number[][] {
  const n = A.length;
  const R = matZeros(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      R[i]![j]! = (A[i]?.[j] ?? 0) * s;
    }
  }
  return R;
}

/** Jacobi eigenvalue algorithm for symmetric A; returns orthogonal B and diagonal eigenvalues λ. */
export function jacobiEigenDecomposition(
  A: readonly (readonly number[])[],
  maxSweep = 64,
  eps = 1e-14,
): { B: number[][]; eigenvalues: number[] } | null {
  const n = A.length;
  if (n === 0) return { B: [], eigenvalues: [] };
  for (let i = 0; i < n; i += 1) {
    if ((A[i]?.length ?? 0) !== n) return null;
  }

  let M = matZeros(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      M[i]![j]! = A[i]![j]!;
    }
  }
  let B = matEye(n);

  for (let sweep = 0; sweep < maxSweep; sweep += 1) {
    let p = 0;
    let q = 1;
    let maxVal = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const v = Math.abs(M[i]![j]!);
        if (v > maxVal) {
          maxVal = v;
          p = i;
          q = j;
        }
      }
    }
    if (maxVal < eps) break;

    const app = M[p]![p]!;
    const aqq = M[q]![q]!;
    const apq = M[p]![q]!;

    if (Math.abs(apq) < eps) {
      break;
    }

    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    const R = matEye(n);
    R[p]![p]! = c;
    R[p]![q]! = -s;
    R[q]![p]! = s;
    R[q]![q]! = c;

    const Rt = transpose(R);
    M = matMul(matMul(Rt, M), R);
    B = matMul(B, R);
  }

  const eigenvalues: number[] = [];
  for (let i = 0; i < n; i += 1) {
    eigenvalues.push(M[i]![i]!);
  }
  return { B, eigenvalues };
}

export function transpose(M: readonly (readonly number[])[]): number[][] {
  const n = M.length;
  const m = M[0]?.length ?? 0;
  const R = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      R[j]![i]! = M[i]![j]!;
    }
  }
  return R;
}

function matMul(A: readonly (readonly number[])[], B: readonly (readonly number[])[]): number[][] {
  const n = A.length;
  const m = B[0]?.length ?? 0;
  const k = B.length;
  const R = matZeros(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      let sum = 0;
      for (let t = 0; t < k; t += 1) {
        sum += (A[i]?.[t] ?? 0) * (B[t]?.[j] ?? 0);
      }
      R[i]![j]! = sum;
    }
  }
  return R;
}

