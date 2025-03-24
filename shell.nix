{ pkgs ? import <nixpkgs> { } }:
pkgs.mkShell {
  nativeBuildInputs = with pkgs.buildPackages; [
    ncurses
    openssh
    git
    corepack_22
    nodejs_22
  ];
}
