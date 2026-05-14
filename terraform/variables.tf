variable "region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t2.micro"
}

variable "ssh_public_key" {
  type        = string
  description = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJHO93TmNzeB2mD8JqPThG2zPXivkWlzSxixBbsXwpX2 江山@LAPTOP-34EJ55O4"
}

variable "repo_url" {
  type        = string
  description = "https://github.com/jiangshan123/DiveSmart.git"
}

variable "repo_branch" {
  type    = string
  default = "main"
}