import { cn } from "@/lib/utils"

type BosonLogoProps = {
  className?: string
  spinToken?: number
}

export function BosonLogo({ className, spinToken = 0 }: BosonLogoProps) {
  return (
    <svg
      key={spinToken}
      viewBox="0 0 753 753"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      style={{
        animationName: "spin",
        animationDuration: "700ms",
        animationTimingFunction: "linear",
        animationIterationCount: 1,
      }}
    >
      <g filter="url(#bosonLogoShadow)">
        <path d="M231.194 12.074L294.933 72.626C318.835 94.9347 331.583 125.211 331.583 158.674C331.583 190.544 344.331 220.82 366.64 243.128L374.607 251.096L447.907 13.6673" fill="currentColor" />
        <path d="M14.481 224.006L102.122 220.82C133.992 219.226 165.861 231.974 188.17 254.283C210.479 276.591 240.755 287.746 272.624 287.746H283.779L165.861 69.4391" fill="currentColor" />
        <path d="M14.4807 526.767L73.4393 463.028C95.748 439.126 126.024 424.785 157.894 424.785C189.763 424.785 218.446 410.443 240.755 388.135L248.722 380.167L9.7002 311.648" fill="currentColor" />
        <path d="M231.193 737.107L226.413 649.465C224.82 617.596 235.974 585.726 258.283 561.824C278.998 539.515 291.746 507.646 290.152 477.37V466.215L73.439 588.913" fill="currentColor" />
        <path d="M533.955 730.733L468.622 673.368C444.72 652.652 430.379 622.376 428.785 588.913C427.192 557.044 412.85 528.361 390.541 506.052L382.574 498.085L318.835 738.7" fill="currentColor" />
        <path d="M741.107 509.239L653.465 515.613C621.596 518.8 589.726 507.646 565.824 485.337C541.922 464.622 511.646 453.467 479.776 455.061H468.622L596.1 668.587" fill="currentColor" />
        <path d="M726.765 208.072L670.993 274.998C650.278 298.9 620.002 314.835 588.133 316.428C556.263 318.022 527.58 332.363 506.865 356.265L500.491 364.233L742.7 421.598" fill="currentColor" />
        <path d="M502.085 5.69995L510.052 93.3413C513.239 125.211 503.679 157.081 481.37 182.576C460.655 206.478 451.094 236.754 452.687 268.624L454.281 279.778L664.62 147.52" fill="currentColor" />
      </g>
      <defs>
        <filter id="bosonLogoShadow" x="0.000195503" y="-4.86374e-05" width="752.4" height="752.4" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="4.85" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.0823529 0 0 0 0 0.729412 0 0 0 0 0.505882 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_31_2" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_31_2" result="shape" />
        </filter>
      </defs>
    </svg>
  )
}
