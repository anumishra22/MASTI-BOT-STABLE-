{ pkgs }: {
  deps = [
    pkgs.freetype
    pkgs.fontconfig
    pkgs.xorg.libXext
    pkgs.xorg.libXrender
    pkgs.xorg.libX11
    pkgs.libGL
    pkgs.libuuid
    pkgs.bashInteractive
    pkgs.nodePackages.bash-language-server
    pkgs.man
  ];
}